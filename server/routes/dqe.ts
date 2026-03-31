import { Router, type Request, type Response, type NextFunction } from "express";
import { ai } from "../ai-client";
import { mimeTypeFromUri } from "../utils";
import {
  requireArchidocUrl,
  archidocJsonPost,
  archidocFetch,
  formatServerError,
} from "./archidoc-helpers";

if (!process.env.OUVRO_API_KEY) {
  console.warn("[DQE] WARNING: OUVRO_API_KEY is not set — requests to Archidoc DQE intake will be unauthenticated");
}

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS = 120_000;

export type DQERouterDeps = {
  fetchVideoDownloadUrl?: (archidocApiUrl: string, videoObjectPath: string) => Promise<string>;
  transcribeVideo?: (videoDownloadUrl: string, mimeType: string) => Promise<string>;
  submitToArchidoc?: (
    archidocApiUrl: string,
    payload: Record<string, unknown>
  ) => Promise<{ data: Record<string, unknown> } | { error: string; status?: number }>;
  validateArchidocUrl?: (req: Request, res: Response, next: NextFunction) => void;
};

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

async function defaultTranscribeVideo(videoDownloadUrl: string, mimeType: string): Promise<string> {
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

  const videoBlob = new Blob([videoBuffer], { type: mimeType });

  const uploadedFile = await ai.files.upload({
    file: videoBlob,
    config: {
      mimeType,
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
            fileData: { mimeType, fileUri },
          },
        ],
      },
    ],
  });

  return response.text?.trim() || "";
}

export async function defaultSubmitToArchidoc(
  archidocApiUrl: string,
  payload: Record<string, unknown>
): Promise<{ data: Record<string, unknown> } | { error: string; status?: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.OUVRO_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  const response = await archidocFetch(`${archidocApiUrl}/api/ouvro/dqe/capture`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    timeout: 60000,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Submit DQE capture to ArchiDoc] ARCHIDOC error:", errorText);
    return { error: "Failed to submit DQE capture to ArchiDoc", status: response.status };
  }
  const data = await response.json();
  return { data };
}

// DQE submit payload contract:
// Client sends `videoObjectPath` (object store key); server resolves the presigned
// download URL internally via Archidoc's /api/field-observations/download-url
// endpoint so that no arbitrary URL is accepted from untrusted input (SSRF prevention).
type DQESubmitBody = {
  localId: string;
  projectId: string;
  projectName: string;
  videoObjectPath: string;
  videoMimeType?: string;
  architectNotes?: string;
  videoDuration: number;
  qualityTier: string;
  capturedAt: string;
  capturedBy: string;
};

export function createDQERouter(deps: DQERouterDeps = {}): Router {
  const effectiveFetchUrl = deps.fetchVideoDownloadUrl ?? defaultFetchVideoDownloadUrl;
  const effectiveTranscribe = deps.transcribeVideo ?? defaultTranscribeVideo;
  const effectiveSubmit = deps.submitToArchidoc ?? defaultSubmitToArchidoc;
  const effectiveValidate = deps.validateArchidocUrl ?? requireArchidocUrl;

  const router = Router();

  router.post("/dqe/submit", effectiveValidate, async (req: Request, res: Response) => {
    const localId: string = req.body.localId || "unknown";

    try {
      const {
        projectId,
        projectName,
        videoObjectPath,
        videoMimeType,
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

      const mimeType = videoMimeType || mimeTypeFromUri(videoObjectPath);
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
        transcription = await effectiveTranscribe(videoUrl, mimeType);
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
        videoMimeType: mimeType,
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
  });

  return router;
}

export const dqeRouter = createDQERouter();
