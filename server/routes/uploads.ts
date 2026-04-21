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

if (!process.env.OUVRO_API_KEY) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Uploads] FATAL CONFIG: OUVRO_API_KEY is not set in production — /api/uploads/request-url will refuse all requests with 500 MISSING_API_KEY until the secret is provisioned",
    );
  } else {
    console.warn(
      "[Uploads] WARNING: OUVRO_API_KEY is not set — requests to Archidoc upload-url will be unauthenticated (development mode)",
    );
  }
}

const UPLOAD_URL_TIMEOUT_MS = 15_000;
const CLIENT_VERSION_HEADER = "x-ouvro-client-version";

type UploadUrlBody = {
  name?: unknown;
  contentType?: unknown;
  size?: unknown;
};

export type UploadsRouterDeps = {
  forwardUploadUrl?: (
    archidocApiUrl: string,
    payload: { name: string; contentType: string; size: number },
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

export async function defaultForwardUploadUrl(
  archidocApiUrl: string,
  payload: { name: string; contentType: string; size: number },
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
        "Server misconfigured: OUVRO_API_KEY is not set — refusing to forward unauthenticated upload-url request to Archidoc",
      status: 500,
      code: "MISSING_API_KEY",
    };
  }

  const response = await archidocFetch(
    `${archidocApiUrl}/api/uploads/request-url`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      timeout: UPLOAD_URL_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[Uploads RequestUrl] ARCHIDOC error (${response.status}):`,
      errorText,
    );
    let parsedCode: string | undefined;
    let parsedMessage: string | undefined;
    if (errorText) {
      try {
        const parsed = JSON.parse(errorText) as {
          error?: string;
          message?: string;
        };
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.error === "string") parsedCode = parsed.error;
          if (typeof parsed.message === "string")
            parsedMessage = parsed.message;
        }
      } catch {}
    }
    return {
      error:
        parsedMessage ||
        parsedCode ||
        "Failed to obtain upload URL from ArchiDoc",
      status: response.status,
      code: parsedCode,
    };
  }

  const data = (await response.json()) as Record<string, unknown>;
  return { data };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function createUploadsRouter(deps: UploadsRouterDeps = {}): Router {
  const router = Router();
  const effectiveForward = deps.forwardUploadUrl ?? defaultForwardUploadUrl;
  const validate = deps.validateArchidocUrl ?? requireArchidocUrl;

  router.post(
    "/uploads/request-url",
    validate,
    async (req: Request, res: ExpressResponse) => {
      try {
        const body = (req.body ?? {}) as UploadUrlBody;
        if (!isNonEmptyString(body.name)) {
          return res.status(400).json({
            error: "Missing required field: name",
            code: "VALIDATION_FAILED",
          });
        }
        if (!isNonEmptyString(body.contentType)) {
          return res.status(400).json({
            error: "Missing required field: contentType",
            code: "VALIDATION_FAILED",
          });
        }
        if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size < 0) {
          return res.status(400).json({
            error: "size must be a non-negative number",
            code: "VALIDATION_FAILED",
          });
        }

        const archidocApiUrl: string = res.locals.archidocApiUrl;
        const clientVersion =
          (req.header(CLIENT_VERSION_HEADER) as string) || "unknown";
        const result = await effectiveForward(
          archidocApiUrl,
          {
            name: body.name,
            contentType: body.contentType,
            size: body.size,
          },
          clientVersion,
        );

        if ("error" in result) {
          return res
            .status(result.status)
            .json({ error: result.error, code: result.code });
        }

        return res.status(200).json(result.data);
      } catch (error: unknown) {
        const { status, message } = formatServerError(
          error,
          "Upload URL request",
        );
        const responseStatus = status === 503 || status === 504 ? status : 502;
        return res.status(responseStatus).json({ error: message });
      }
    },
  );

  return router;
}

export const uploadsRouter = createUploadsRouter();
