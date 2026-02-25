import type { Request, Response, NextFunction } from "express";

const ARCHIDOC_TIMEOUT_MS = 15000;
export const ARCHIDOC_UPLOAD_TIMEOUT_MS = 60000;

export function archidocFetch(url: string, options: RequestInit & { timeout?: number } = {}): Promise<globalThis.Response> {
  const timeoutMs = options.timeout || ARCHIDOC_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).then((response) => {
    clearTimeout(timeoutId);
    return response;
  }).catch((error) => {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`ARCHIDOC request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw error;
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes("timed out") ||
    error.name === "AbortError"
  );
}

export function formatServerError(error: unknown, context: string): { status: number; message: string } {
  if (isTimeoutError(error)) {
    console.error(`[${context}] Timeout:`, error);
    return { status: 504, message: `ARCHIDOC server took too long to respond. Please retry.` };
  }
  if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("network"))) {
    console.error(`[${context}] Network error:`, error);
    return { status: 503, message: `Cannot reach ARCHIDOC server. Please retry shortly.` };
  }
  console.error(`[${context}] Error:`, error);
  return { status: 500, message: `${context} failed. Please retry.` };
}

export function requireArchidocUrl(req: Request, res: Response, next: NextFunction) {
  const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
  if (!archidocApiUrl) {
    return res.status(503).json({ success: false, error: "ARCHIDOC API URL not configured. Service unavailable." });
  }
  res.locals.archidocApiUrl = archidocApiUrl;
  next();
}

export async function archidocJsonPost(
  url: string,
  body: object,
  context: string,
  timeout?: number
): Promise<{ data: any } | { error: string; status: number }> {
  const response = await archidocFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${context}] ARCHIDOC error:`, errorText);
    return { error: `Failed to ${context.toLowerCase()}`, status: response.status };
  }

  const data = await response.json();
  return { data };
}

export function buildArchidocObservationPayload(fields: {
  projectId: string;
  title: string;
  description?: string | null;
  observedBy?: string;
  observedAt?: string;
  transcription?: string | null;
  translatedText?: string | null;
}) {
  return {
    projectId: fields.projectId,
    observedBy: fields.observedBy || "OUVRO Field User",
    summary: fields.title + (fields.description ? `: ${fields.description}` : ""),
    observedAt: fields.observedAt || new Date().toISOString(),
    classification: "general",
    status: "pending",
    priority: "normal",
    transcription: fields.transcription || undefined,
    translatedText: fields.translatedText || undefined,
  };
}
