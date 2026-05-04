import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";

import {
  applyExpoStaticCacheHeaders,
  IMMUTABLE_CACHE_CONTROL,
  MANIFEST_CACHE_CONTROL,
  MANIFEST_VARY,
  DEFAULT_STATIC_CACHE_CONTROL,
} from "../cache-headers";

// ---------------------------------------------------------------------------
// Unit tests: pure header-setter contract.
// ---------------------------------------------------------------------------

function captureHeaders(filePath: string): Record<string, string> {
  const headers: Record<string, string> = {};
  applyExpoStaticCacheHeaders(
    {
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name] = String(value);
        return this as never;
      },
    } as never,
    filePath,
  );
  return headers;
}

test("immutable: /<timestamp>/_expo/static/js/<platform>/bundle.js", () => {
  const headers = captureHeaders(
    "/srv/static-build/1730000000000/_expo/static/js/ios/bundle.js",
  );
  assert.equal(headers["Cache-Control"], IMMUTABLE_CACHE_CONTROL);
});

test("immutable: hashed asset under /<timestamp>/_expo/static/", () => {
  const headers = captureHeaders(
    "/srv/static-build/1730000000000/_expo/static/media/icon.abcdef12.png",
  );
  assert.equal(headers["Cache-Control"], IMMUTABLE_CACHE_CONTROL);
});

test("immutable: legacy .bundle path", () => {
  const headers = captureHeaders("/srv/static-build/index.bundle");
  assert.equal(headers["Cache-Control"], IMMUTABLE_CACHE_CONTROL);
});

test("manifest.json: stale-while-revalidate + Vary", () => {
  const headers = captureHeaders("/srv/static-build/ios/manifest.json");
  assert.equal(headers["Cache-Control"], MANIFEST_CACHE_CONTROL);
  assert.equal(headers["Vary"], MANIFEST_VARY);
  assert.match(headers["Cache-Control"], /stale-while-revalidate=2592000/);
});

test("uncachable fallback for arbitrary file", () => {
  const headers = captureHeaders("/srv/static-build/robots.txt");
  assert.equal(headers["Cache-Control"], DEFAULT_STATIC_CACHE_CONTROL);
});

// ---------------------------------------------------------------------------
// Integration test: real express.static middleware over HTTP.
// Builds the same wiring server/index.ts uses for the static-build mount and
// asserts the response headers a real Expo Go client would observe.
// ---------------------------------------------------------------------------

test("express.static serves bundle.js with immutable Cache-Control", async () => {
  const root = mkdtempSync(join(tmpdir(), "ouvro-cache-headers-"));
  try {
    const bundleDir = join(root, "1730000000000", "_expo", "static", "js", "ios");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(join(bundleDir, "bundle.js"), "// fake bundle\n");

    const manifestDir = join(root, "ios");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "manifest.json"),
      JSON.stringify({ id: "test" }),
    );

    const app = express();
    app.use(
      express.static(root, { setHeaders: applyExpoStaticCacheHeaders }),
    );

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    try {
      const bundleRes = await fetch(
        `${base}/1730000000000/_expo/static/js/ios/bundle.js`,
      );
      assert.equal(bundleRes.status, 200);
      assert.equal(
        bundleRes.headers.get("cache-control"),
        IMMUTABLE_CACHE_CONTROL,
        "bundle.js must be served as immutable so Expo Go never re-downloads it on cold launch",
      );

      const manifestRes = await fetch(`${base}/ios/manifest.json`);
      assert.equal(manifestRes.status, 200);
      const manifestCacheControl = manifestRes.headers.get("cache-control") ?? "";
      assert.equal(manifestCacheControl, MANIFEST_CACHE_CONTROL);
      assert.match(
        manifestCacheControl,
        /stale-while-revalidate=2592000/,
        "manifest must keep the 30-day stale-while-revalidate window",
      );
      assert.equal(manifestRes.headers.get("vary"), MANIFEST_VARY);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
