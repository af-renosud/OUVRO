import { Router, type Request, type Response, type NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import {
  requireArchidocUrl,
  archidocJsonPost,
  archidocFetch,
  formatServerError,
} from "./archidoc-helpers";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB ceiling (covers 3-min 4K hvc1)
const TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS = 120_000; // 2 min to download large video

// ── Injectable dependency types ──────────────────────────────────────────────

type ArchidocPostResult =
  | { data: Record<string, unknown> }
  | { error: string; status?: number };

export type DQERouterDeps = {
  /**
   * Calls Archidoc's download-url endpoint and returns a presigned CDN URL.
   * Override in tests to avoid real HTTP traffic.
   */
  fetchVideoDownloadUrl?: (
    archidocApiUrl: string,
    videoObjectPath: string
  ) => Promise<string>;

  /**
   * Downloads the video from a CDN URL and transcribes it with Gemini.
   * Override in tests to avoid real Gemini API calls.
   */
  transcribeVideo?: (videoDownloadUrl: string) => Promise<string>;

  /**
   * Forwards the DQE capture payload to Archidoc's DQE intake endpoint.
   * Override in tests to avoid real Archidoc traffic.
   */
  submitToArchidoc?: (
    archidocApiUrl: string,
    payload: Record<string, unknown>
  ) => Promise<ArchidocPostResult>;

  /**
   * Express middleware that validates and injects `res.locals.archidocApiUrl`.
   * Override in tests to skip env-var requirements.
   */
  validateArchidocUrl?: (req: Request, res: Response, next: NextFunction) => void;
};

// ── Default implementations (production) ────────────────────────────────────

async function defaultFetchVideoDownloadUrl(
  archidocApiUrl: string,
  videoObjectPath: string
): Promise<string> {
  const result = await archidocJsonPost(
    `${archidocApiUrl}/api/field-observations/download-url`,
    { objectPath: videoObjectPath },
    "Resolve video download URL",
    15000
  );
  if ("error" in result) {
    throw new Error(`Could not resolve download URL for objectPath: ${result.error}`);
  }
  const url: unknown =
    (result.data as Record<string, unknown>).downloadURL ||
    (result.data as Record<string, unknown>).downloadUrl ||
    (result.data as Record<string, unknown>).url;
  if (typeof url !== "string" || !url) {
    throw new Error("Archidoc download-url response missing URL field");
  }
  return url;
}

async function defaultTranscribeVideo(videoDownloadUrl: string): Promise<string> {
  const videoResponse = await archidocFetch(videoDownloadUrl, {
    timeout: TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS,
  });
  if (!videoResponse.ok) {
    throw new Error(`Video download failed with status ${videoResponse.status}`);
  }

  const contentLength = videoResponse.headers.get("content-length");
  if (contentLength !== null) {
    const byteSize = parseInt(contentLength, 10);
    if (!isNaN(byteSize) && byteSize > MAX_VIDEO_BYTES) {
      throw new Error(
        `Video too large for transcription: ${(byteSize / (1024 * 1024)).toFixed(0)} MB exceeds ${(MAX_VIDEO_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB limit`
      );
    }
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  if (videoBuffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video too large for transcription: ${(videoBuffer.byteLength / (1024 * 1024)).toFixed(0)} MB exceeds ${(MAX_VIDEO_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB limit`
    );
  }

  const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

  const uploadedFile = await ai.files.upload({
    file: videoBlob,
    config: {
      mimeType: "video/mp4",
      displayName: `dqe_narration_${Date.now()}`,
    },
  });

  const fileUri = uploadedFile.uri;
  if (!fileUri) {
    throw new Error("Gemini Files API returned no URI for uploaded video");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcris la narration de cet architecte sur le chantier. Concentre-toi sur les observations de construction, défauts, numéros de lot, références aux entreprises. Reproduis le texte tel quel, sans reformulation ni résumé.",
          },
          {
            fileData: { mimeType: "video/mp4", fileUri },
          },
        ],
      },
    ],
  });

  return response.text?.trim() || "";
}

async function defaultSubmitToArchidoc(
  archidocApiUrl: string,
  payload: Record<string, unknown>
): Promise<ArchidocPostResult> {
  return archidocJsonPost(
    `${archidocApiUrl}/api/ouvro/dqe/capture`,
    payload,
    "Submit DQE capture to ArchiDoc",
    60000
  );
}

// ── Route body type ──────────────────────────────────────────────────────────

type DQESubmitBody = {
  localId: string;
  projectId: string;
  projectName: string;
  videoObjectPath: string;
  architectNotes?: string;
  videoDuration: number;
  qualityTier: string;
  capturedAt: string;
  capturedBy: string;
};

// ── Router factory ───────────────────────────────────────────────────────────

/**
 * Creates the DQE domain router.  All external I/O is injected via `deps` so
 * that tests can supply mocks without patching real modules.
 *
 * Production usage: `createDQERouter()` — all deps default to real implementations.
 * Test usage:       `createDQERouter({ fetchVideoDownloadUrl: mockFn, ... })`.
 */
export function createDQERouter(deps: DQERouterDeps = {}): Router {
  const effectiveFetchUrl = deps.fetchVideoDownloadUrl ?? defaultFetchVideoDownloadUrl;
  const effectiveTranscribe = deps.transcribeVideo ?? defaultTranscribeVideo;
  const effectiveSubmit = deps.submitToArchidoc ?? defaultSubmitToArchidoc;
  const effectiveValidate = deps.validateArchidocUrl ?? requireArchidocUrl;

  const router = Router();

  router.post(
    "/dqe/submit",
    effectiveValidate,
    async (req: Request, res: Response) => {
      const localId: string = req.body.localId || "unknown";

      try {
        const {
          projectId,
          projectName,
          videoObjectPath,
          architectNotes,
          videoDuration,
          qualityTier,
          capturedAt,
          capturedBy,
        } = req.body as DQESubmitBody;

        console.log(`[DQE Submit] localId=${localId} — received DQE submission`);

        if (!localId || localId === "unknown") {
          return res.status(400).json({ success: false, error: "Missing required field: localId", localId });
        }
        if (!projectId) {
          return res.status(400).json({ success: false, error: "Missing required field: projectId", localId });
        }
        if (!videoObjectPath) {
          return res.status(400).json({ success: false, error: "Missing required field: videoObjectPath", localId });
        }

        const archidocApiUrl: string = res.locals.archidocApiUrl;

        console.log(`[DQE Submit] localId=${localId} — resolving video download URL from Archidoc`);
        let videoUrl: string;
        try {
          videoUrl = await effectiveFetchUrl(archidocApiUrl, videoObjectPath);
        } catch (urlErr: unknown) {
          const msg = urlErr instanceof Error ? urlErr.message : "Failed to resolve video URL";
          console.warn(`[DQE Submit] localId=${localId} — download URL resolution failed: ${msg}`);
          return res.status(502).json({ success: false, error: `Video URL unavailable: ${msg}`, localId });
        }

        console.log(`[DQE Submit] localId=${localId} — transcribing video narration via Gemini`);
        let transcription: string;
        try {
          transcription = await effectiveTranscribe(videoUrl);
          console.log(`[DQE Submit] localId=${localId} — transcription complete (${transcription.length} chars)`);
        } catch (transcribeErr: unknown) {
          const msg = transcribeErr instanceof Error ? transcribeErr.message : "Transcription failed";
          console.warn(`[DQE Submit] localId=${localId} — transcription failed: ${msg}`);
          return res.status(502).json({ success: false, error: `Transcription failed: ${msg}`, localId });
        }

        const archidocPayload: Record<string, unknown> = {
          localId,
          projectId,
          projectName: projectName || "Unknown Project",
          videoObjectPath,
          videoUrl,
          transcription,
          videoDuration: videoDuration || 0,
          qualityTier: qualityTier || "standard",
          capturedAt: capturedAt || new Date().toISOString(),
          capturedBy: capturedBy || "OUVRO Field User",
          ...(architectNotes ? { architectNotes } : {}),
        };

        console.log(`[DQE Submit] localId=${localId} — posting to ArchiDoc DQE for project ${projectId}`);

        const result = await effectiveSubmit(archidocApiUrl, archidocPayload);

        if ("error" in result) {
          console.warn(`[DQE Submit] localId=${localId} — ArchiDoc error: ${result.error} (${result.status ?? "?"})`);
          return res.status(502).json({ success: false, error: result.error, localId });
        }

        const archidocDQEId: string =
          (result.data?.id as string) ||
          (result.data?.dqeId as string) ||
          (result.data?.dqe_id as string) ||
          (result.data?.captureId as string) ||
          `dqe_archidoc_${Date.now()}`;

        console.log(`[DQE Submit] localId=${localId} — submitted OK, archidocDQEId=${archidocDQEId}`);

        return res.status(200).json({ success: true, localId, archidocDQEId, transcription });
      } catch (error: unknown) {
        console.error(`[DQE Submit] localId=${localId} — unexpected error:`, error);
        const { status, message } = formatServerError(error, "DQE Submit");
        const responseStatus = status === 503 || status === 504 ? status : 502;
        return res.status(responseStatus).json({ success: false, error: message, localId });
      }
    }
  );

  return router;
}

/** Production router — uses all real implementations. */
export const dqeRouter = createDQERouter();
