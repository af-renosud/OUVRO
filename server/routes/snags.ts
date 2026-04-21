import {
  Router,
  type Request,
  type Response as ExpressResponse,
  type NextFunction,
} from "express";
import {
  requireArchidocUrl,
  archidocFetch,
  formatServerError,
} from "./archidoc-helpers";

if (!process.env.OUVRO_API_KEY && process.env.NODE_ENV !== "production") {
  console.warn(
    "[Snags] WARNING: OUVRO_API_KEY is not set — requests to Archidoc snag intake will be unauthenticated (development mode)",
  );
}

const SNAG_SUBMIT_TIMEOUT_MS = 30_000;
const CLIENT_VERSION_HEADER = "x-ouvro-client-version";

type SnagMediaInput = {
  type?: string;
  objectPath?: string;
  publicUrl?: string;
  mimeType?: string;
  durationSeconds?: number;
};

type SnagSubmitBody = {
  localId?: string;
  projectId?: string;
  projectName?: string;
  type?: string;
  title?: string;
  description?: string;
  severity?: string;
  contractorId?: string;
  contractorName?: string;
  location?: string;
  media?: SnagMediaInput[];
  capturedAt?: string;
  capturedBy?: string;
};

const ALLOWED_TYPES = new Set(["defaut", "reserve"]);
const ALLOWED_SEVERITIES = new Set(["minor", "major", "critical"]);
const ALLOWED_MEDIA_TYPES = new Set(["photo", "video", "audio"]);

export type SnagsRouterDeps = {
  forwardToArchidoc?: (
    archidocApiUrl: string,
    payload: Record<string, unknown>,
    clientVersion: string,
  ) => Promise<
    | { data: Record<string, unknown> }
    | { error: string; status: number; code?: string }
  >;
  validateArchidocUrl?: (
    req: Request,
    res: ExpressResponse,
    next: NextFunction,
  ) => void;
};

async function defaultForwardToArchidoc(
  archidocApiUrl: string,
  payload: Record<string, unknown>,
  clientVersion: string,
): Promise<
  | { data: Record<string, unknown> }
  | { error: string; status: number; code?: string }
> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OUVRO-Client-Version": clientVersion,
  };
  const apiKey = process.env.OUVRO_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (process.env.NODE_ENV === "production") {
    return {
      error:
        "Server misconfigured: OUVRO_API_KEY is not set — refusing to forward unauthenticated request to Archidoc",
      status: 500,
      code: "MISSING_API_KEY",
    };
  }
  const response = await archidocFetch(`${archidocApiUrl}/api/ouvro/snags`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    timeout: SNAG_SUBMIT_TIMEOUT_MS,
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[Snags Submit] ARCHIDOC error (${response.status}):`,
      errorText,
    );
    if (response.status === 503) {
      return {
        error: "Snag intake is not enabled on this Archidoc instance",
        status: 503,
        code: "FEATURE_DISABLED",
      };
    }
    return {
      error: "Failed to submit snag to ArchiDoc",
      status: response.status,
    };
  }
  const data = (await response.json()) as Record<string, unknown>;
  return { data };
}

function validateMediaItem(item: SnagMediaInput): string | null {
  if (!item || typeof item !== "object") return "media item must be an object";
  if (!item.type || !ALLOWED_MEDIA_TYPES.has(item.type)) {
    return `media.type must be one of ${Array.from(ALLOWED_MEDIA_TYPES).join(", ")}`;
  }
  if (!item.objectPath || typeof item.objectPath !== "string") {
    return "media.objectPath is required";
  }
  if (!item.mimeType || typeof item.mimeType !== "string") {
    return "media.mimeType is required";
  }
  return null;
}

export function createSnagsRouter(deps: SnagsRouterDeps = {}): Router {
  const effectiveValidate = deps.validateArchidocUrl ?? requireArchidocUrl;
  const effectiveForward = deps.forwardToArchidoc ?? defaultForwardToArchidoc;

  const router = Router();

  router.post(
    "/snags/submit",
    effectiveValidate,
    async (req: Request, res: ExpressResponse) => {
      const body = (req.body || {}) as SnagSubmitBody;
      const localId: string = body.localId || "unknown";

      try {
        if (!localId || localId === "unknown") {
          return res.status(400).json({
            success: false,
            error: "Missing required field: localId",
            localId,
          });
        }
        if (!body.projectId) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: projectId",
            localId,
          });
        }
        if (!body.type || !ALLOWED_TYPES.has(body.type)) {
          return res.status(400).json({
            success: false,
            error: `Invalid type — must be one of ${Array.from(ALLOWED_TYPES).join(", ")}`,
            localId,
          });
        }
        if (!body.title || typeof body.title !== "string") {
          return res.status(400).json({
            success: false,
            error: "Missing required field: title",
            localId,
          });
        }
        if (!body.capturedAt) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: capturedAt",
            localId,
          });
        }
        if (!body.capturedBy) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: capturedBy",
            localId,
          });
        }
        if (!Array.isArray(body.media) || body.media.length === 0) {
          return res.status(400).json({
            success: false,
            error: "At least one media item is required",
            localId,
          });
        }
        for (const m of body.media) {
          const err = validateMediaItem(m);
          if (err) {
            return res.status(400).json({ success: false, error: err, localId });
          }
        }
        if (body.severity && !ALLOWED_SEVERITIES.has(body.severity)) {
          return res.status(400).json({
            success: false,
            error: `Invalid severity — must be one of ${Array.from(ALLOWED_SEVERITIES).join(", ")}`,
            localId,
          });
        }

        const archidocApiUrl: string = res.locals.archidocApiUrl;
        const clientVersion =
          (req.header(CLIENT_VERSION_HEADER) as string) || "unknown";

        const payload: Record<string, unknown> = {
          localId,
          projectId: body.projectId,
          projectName: body.projectName || "Unknown Project",
          type: body.type,
          title: body.title,
          capturedAt: body.capturedAt,
          capturedBy: body.capturedBy,
          media: body.media,
          ...(body.description ? { description: body.description } : {}),
          ...(body.severity ? { severity: body.severity } : {}),
          ...(body.contractorId ? { contractorId: body.contractorId } : {}),
          ...(body.contractorName ? { contractorName: body.contractorName } : {}),
          ...(body.location ? { location: body.location } : {}),
        };

        const result = await effectiveForward(
          archidocApiUrl,
          payload,
          clientVersion,
        );

        if ("error" in result) {
          return res.status(result.status).json({
            success: false,
            error: result.error,
            code: result.code,
            localId,
          });
        }

        const archidocSnagId: string =
          (result.data?.id as string) ||
          (result.data?.snagId as string) ||
          (result.data?.snag_id as string) ||
          `snag_archidoc_${Date.now()}`;
        const deepLink: string | undefined =
          (result.data?.deepLink as string) ||
          (result.data?.deep_link as string) ||
          undefined;

        return res
          .status(200)
          .json({ success: true, localId, archidocSnagId, deepLink });
      } catch (error: unknown) {
        const { status, message } = formatServerError(error, "Snag Submit");
        const responseStatus = status === 503 || status === 504 ? status : 502;
        return res
          .status(responseStatus)
          .json({ success: false, error: message, localId });
      }
    },
  );

  return router;
}

export const snagsRouter = createSnagsRouter();
