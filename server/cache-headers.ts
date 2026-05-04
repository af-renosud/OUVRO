import type { Response } from "express";

export const IMMUTABLE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

export const MANIFEST_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=2592000";

export const MANIFEST_VARY = "expo-platform, Accept";

export const DEFAULT_STATIC_CACHE_CONTROL = "public, max-age=86400";

export function isImmutableExpoBundlePath(filePath: string): boolean {
  if (filePath.endsWith(".bundle")) return true;
  if (filePath.includes("/bundles/")) return true;
  if (/\/\d+(?:-\d+)?\/_expo\/static\//.test(filePath)) return true;
  return false;
}

export function isContentHashedAsset(filePath: string): boolean {
  return /\.[0-9a-f]{8,}\./.test(filePath);
}

type HeaderSink = Pick<Response, "setHeader">;

export function applyExpoStaticCacheHeaders(
  res: HeaderSink,
  filePath: string,
): void {
  if (filePath.endsWith("manifest.json")) {
    res.setHeader("Cache-Control", MANIFEST_CACHE_CONTROL);
    res.setHeader("Vary", MANIFEST_VARY);
    return;
  }

  if (isImmutableExpoBundlePath(filePath)) {
    res.setHeader("Cache-Control", IMMUTABLE_CACHE_CONTROL);
    return;
  }

  if (isContentHashedAsset(filePath)) {
    res.setHeader("Cache-Control", IMMUTABLE_CACHE_CONTROL);
    return;
  }

  res.setHeader("Cache-Control", DEFAULT_STATIC_CACHE_CONTROL);
}
