import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { ai } from "../ai-client";
import { mimeTypeFromUri } from "../utils";
import {
  requireArchidocUrl,
  archidocJsonPost,
  archidocFetch,
  formatServerError,
} from "./archidoc-helpers";

if (!process.env.OUVRO_API_KEY) {
  console.warn(
    "[DQE] WARNING: OUVRO_API_KEY is not set — requests to Archidoc DQE intake will be unauthenticated",
  );
}

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS = 120_000;

export type DQERouterDeps = {
  fetchVideoDownloadUrl?: (
    archidocApiUrl: string,
    videoObjectPath: string,
  ) => Promise<string>;
  transcribeVideo?: (
    videoDownloadUrl: string,
    mimeType: string,
  ) => Promise<string>;
  submitToArchidoc?: (
    archidocApiUrl: string,
    payload: Record<string, unknown>,
  ) => Promise<
    { data: Record<string, unknown> } | { error: string; status?: number }
  >;
  validateArchidocUrl?: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;
};

async function defaultFetchVideoDownloadUrl(
  archidocApiUrl: string,
  videoObjectPath: string,
): Promise<string> {
  const result = await archidocJsonPost(
    `${archidocApiUrl}/api/field-observations/download-url`,
    { objectPath: videoObjectPath },
    "Resolve video download URL",
    15000,
  );
  if ("error" in result) {
    throw new Error(
      `Could not resolve download URL for objectPath: ${result.error}`,
    );
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

async function defaultTranscribeVideo(
  videoDownloadUrl: string,
  mimeType: string,
): Promise<string> {
  const videoResponse = await archidocFetch(videoDownloadUrl, {
    timeout: TRANSCRIPTION_DOWNLOAD_TIMEOUT_MS,
  });
  if (!videoResponse.ok) {
    throw new Error(
      `Video download failed with status ${videoResponse.status}`,
    );
  }

  const contentLength = videoResponse.headers.get("content-length");
  if (contentLength !== null) {
    const byteSize = parseInt(contentLength, 10);
    if (!isNaN(byteSize) && byteSize > MAX_VIDEO_BYTES) {
      throw new Error(
        `Video too large for transcription: ${(byteSize / (1024 * 1024)).toFixed(0)} MB exceeds ${(MAX_VIDEO_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB limit`,
      );
    }
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  if (videoBuffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video too large for transcription: ${(videoBuffer.byteLength / (1024 * 1024)).toFixed(0)} MB exceeds ${(MAX_VIDEO_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB limit`,
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
  payload: Record<string, unknown>,
): Promise<
  { data: Record<string, unknown> } | { error: string; status?: number }
> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.OUVRO_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  const response = await archidocFetch(
    `${archidocApiUrl}/api/ouvro/dqe/capture`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      timeout: 60000,
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "[Submit DQE capture to ArchiDoc] ARCHIDOC error:",
      errorText,
    );
    return {
      error: "Failed to submit DQE capture to ArchiDoc",
      status: response.status,
    };
  }
  const data = await response.json();
  return { data };
}

// SSRF-safe check for a client-supplied video URL.
// Requires HTTPS and blocks the full set of private/reserved address ranges
// for both IPv4 and IPv6 so no crafted videoUrl value can reach an internal
// endpoint. DNS-rebinding attacks (a hostname that publicly resolves to a
// private IP) are a residual risk not addressed here — that requires async
// resolver checks and is mitigated at the infrastructure level (VPC firewall).
function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Strip IPv6 brackets: "[::1]" → "::1"
    const host = parsed.hostname.replace(/^\[(.+)]$/, "$1").toLowerCase();

    // ── IPv4 private / reserved ────────────────────────────────────────────
    // Loopback (127.0.0.0/8)
    if (/^127\.\d+\.\d+\.\d+$/.test(host)) return false;
    // Private class A (10.0.0.0/8)
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return false;
    // Private class B (172.16.0.0/12)
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return false;
    // Private class C (192.168.0.0/16)
    if (/^192\.168\.\d+\.\d+$/.test(host)) return false;
    // Link-local / cloud metadata (169.254.0.0/16)
    if (/^169\.254\.\d+\.\d+$/.test(host)) return false;
    // Shared address space (100.64.0.0/10)
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host)) return false;

    // ── IPv6 private / reserved ────────────────────────────────────────────
    // Loopback (::1)
    if (host === "::1") return false;
    // Link-local (fe80::/10)
    if (/^fe[89ab]/i.test(host)) return false;
    // Unique local (fc00::/7 — covers fc and fd prefixes)
    if (/^f[cd]/i.test(host)) return false;
    // IPv4-mapped IPv6 (::ffff:0:0/96).
    // Node.js WHATWG URL normalises ::ffff:10.0.0.1 → ::ffff:a00:1 (hex groups),
    // so matching on decimal dotted notation alone misses the normalised form.
    // Block the entire ::ffff: prefix — no legitimate external storage URL
    // should ever be expressed as an IPv4-mapped IPv6 address.
    if (/^::ffff:/i.test(host)) return false;

    // ── Common internal hostnames ──────────────────────────────────────────
    if (host === "localhost") return false;
    if (host.endsWith(".internal") || host.endsWith(".local")) return false;

    return true;
  } catch {
    return false;
  }
}

// DQE submit payload contract:
// Primary path: client passes videoUrl (the publicUrl from Archidoc's upload-url
//   response) so the server can skip the separate download-url resolution call.
//   The URL is validated server-side against an SSRF allowlist before use.
// Fallback path: if videoUrl is absent, server calls Archidoc's
//   /api/field-observations/download-url with videoObjectPath — the original
//   server-side-only resolution pattern (SSRF-safe because no client input
//   reaches the fetch target).
type DQESubmitBody = {
  localId: string;
  projectId: string;
  projectName: string;
  videoObjectPath: string;
  videoUrl?: string;
  videoMimeType?: string;
  architectNotes?: string;
  videoDuration: number;
  qualityTier: string;
  capturedAt: string;
  capturedBy: string;
};

export function createDQERouter(deps: DQERouterDeps = {}): Router {
  const effectiveFetchUrl =
    deps.fetchVideoDownloadUrl ?? defaultFetchVideoDownloadUrl;
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
          videoUrl: clientVideoUrl,
          videoMimeType,
          architectNotes,
          videoDuration,
          qualityTier,
          capturedAt,
          capturedBy,
        } = req.body as DQESubmitBody;

        console.log(
          `[DQE Submit] localId=${localId} — received DQE submission`,
        );

        if (!localId || localId === "unknown") {
          return res
            .status(400)
            .json({
              success: false,
              error: "Missing required field: localId",
              localId,
            });
        }
        if (!projectId) {
          return res
            .status(400)
            .json({
              success: false,
              error: "Missing required field: projectId",
              localId,
            });
        }
        if (!videoObjectPath) {
          return res
            .status(400)
            .json({
              success: false,
              error: "Missing required field: videoObjectPath",
              localId,
            });
        }

        const mimeType = videoMimeType || mimeTypeFromUri(videoObjectPath);
        const archidocApiUrl: string = res.locals.archidocApiUrl;

        let videoUrl: string;

        if (clientVideoUrl && isAllowedVideoUrl(clientVideoUrl)) {
          // Fast path: client supplied the publicUrl from the upload-url response.
          // Validated against SSRF blocklist above — safe to use directly.
          console.log(
            `[DQE Submit] localId=${localId} — using pre-resolved video URL from client`,
          );
          videoUrl = clientVideoUrl;
        } else {
          if (clientVideoUrl) {
            // URL was provided but failed the SSRF check — log and fall through
            // to the server-side resolution so the request still succeeds.
            console.warn(
              `[DQE Submit] localId=${localId} — client-supplied videoUrl rejected by SSRF check, falling back to server-side resolution`,
            );
          } else {
            console.log(
              `[DQE Submit] localId=${localId} — resolving video download URL from Archidoc`,
            );
          }
          try {
            videoUrl = await effectiveFetchUrl(archidocApiUrl, videoObjectPath);
          } catch (urlErr: unknown) {
            const msg =
              urlErr instanceof Error
                ? urlErr.message
                : "Failed to resolve video URL";
            console.warn(
              `[DQE Submit] localId=${localId} — download URL resolution failed: ${msg}`,
            );
            return res
              .status(502)
              .json({
                success: false,
                error: `Video URL unavailable: ${msg}`,
                localId,
              });
          }
        }

        console.log(
          `[DQE Submit] localId=${localId} — transcribing video narration via Gemini`,
        );
        let transcription: string;
        try {
          transcription = await effectiveTranscribe(videoUrl, mimeType);
          console.log(
            `[DQE Submit] localId=${localId} — transcription complete (${transcription.length} chars)`,
          );
        } catch (transcribeErr: unknown) {
          const msg =
            transcribeErr instanceof Error
              ? transcribeErr.message
              : "Transcription failed";
          console.warn(
            `[DQE Submit] localId=${localId} — transcription failed: ${msg}`,
          );
          return res
            .status(502)
            .json({
              success: false,
              error: `Transcription failed: ${msg}`,
              localId,
            });
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

        console.log(
          `[DQE Submit] localId=${localId} — posting to ArchiDoc DQE for project ${projectId}`,
        );

        const result = await effectiveSubmit(archidocApiUrl, archidocPayload);

        if ("error" in result) {
          console.warn(
            `[DQE Submit] localId=${localId} — ArchiDoc error: ${result.error} (${result.status ?? "?"})`,
          );
          return res
            .status(502)
            .json({ success: false, error: result.error, localId });
        }

        const archidocDQEId: string =
          (result.data?.id as string) ||
          (result.data?.dqeId as string) ||
          (result.data?.dqe_id as string) ||
          (result.data?.captureId as string) ||
          `dqe_archidoc_${Date.now()}`;

        console.log(
          `[DQE Submit] localId=${localId} — submitted OK, archidocDQEId=${archidocDQEId}`,
        );

        return res
          .status(200)
          .json({ success: true, localId, archidocDQEId, transcription });
      } catch (error: unknown) {
        console.error(
          `[DQE Submit] localId=${localId} — unexpected error:`,
          error,
        );
        const { status, message } = formatServerError(error, "DQE Submit");
        const responseStatus = status === 503 || status === 504 ? status : 502;
        return res
          .status(responseStatus)
          .json({ success: false, error: message, localId });
      }
    },
  );

  return router;
}

export const dqeRouter = createDQERouter();
