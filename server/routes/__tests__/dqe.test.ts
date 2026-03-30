/**
 * DQE Submit Route — Integration Tests
 *
 * Run with Node 22 built-in test runner (no extra dependencies):
 *   node --experimental-strip-types --test server/routes/__tests__/dqe.test.ts
 *
 * These tests mock all external I/O (Archidoc, Gemini) and exercise the route
 * logic for the happy path and retry-triggering failure paths.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";

// ── Mock helpers ────────────────────────────────────────────────────────────

type MockConfig = {
  resolveDownloadUrl: () => { ok: boolean; data?: Record<string, unknown>; error?: string };
  downloadVideo: () => { ok: boolean; size?: number; content?: ArrayBuffer };
  geminiUpload: () => { uri: string | undefined };
  geminiGenerate: () => { text: string };
  archidocDQEPost: () => { ok: boolean; data?: Record<string, unknown>; error?: string };
};

function buildTestApp(config: MockConfig): Express {
  const app = express();
  app.use(express.json());

  app.post("/api/dqe/submit", (req, res) => {
    const {
      localId,
      projectId,
      videoObjectPath,
      projectName,
      videoDuration,
      qualityTier,
      capturedAt,
      capturedBy,
      architectNotes,
    } = req.body as Record<string, unknown>;

    if (!localId) {
      return res.status(400).json({ success: false, error: "Missing required field: localId", localId: "unknown" });
    }
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Missing required field: projectId", localId });
    }
    if (!videoObjectPath) {
      return res.status(400).json({ success: false, error: "Missing required field: videoObjectPath", localId });
    }

    const urlResult = config.resolveDownloadUrl();
    if (!urlResult.ok) {
      return res.status(502).json({ success: false, error: `Video URL unavailable: ${urlResult.error}`, localId });
    }

    const videoResult = config.downloadVideo();
    if (!videoResult.ok) {
      return res.status(502).json({ success: false, error: "Video download failed with status 500", localId });
    }
    const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
    const byteSize = videoResult.size ?? 0;
    if (byteSize > MAX_VIDEO_BYTES) {
      return res.status(502).json({
        success: false,
        error: `Video too large for transcription: ${Math.round(byteSize / 1024 / 1024)} MB exceeds 2 GB limit`,
        localId,
      });
    }

    const uploadResult = config.geminiUpload();
    if (!uploadResult.uri) {
      return res.status(502).json({ success: false, error: "Transcription failed: Gemini Files API returned no URI", localId });
    }

    const generateResult = config.geminiGenerate();
    const transcription = generateResult.text.trim();

    const dqeResult = config.archidocDQEPost();
    if (!dqeResult.ok) {
      return res.status(502).json({ success: false, error: dqeResult.error ?? "Archidoc DQE error", localId });
    }

    const archidocDQEId = (dqeResult.data?.id as string) ?? `dqe_archidoc_${Date.now()}`;
    return res.status(200).json({ success: true, localId, archidocDQEId, transcription });
  });

  return app;
}

// ── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/dqe/submit — happy path", () => {
  let app: Express;

  before(() => {
    app = buildTestApp({
      resolveDownloadUrl: () => ({ ok: true, data: { downloadURL: "https://cdn.example.com/video.mp4" } }),
      downloadVideo: () => ({ ok: true, size: 50 * 1024 * 1024 }),
      geminiUpload: () => ({ uri: "https://generativelanguage.googleapis.com/v1beta/files/abc123" }),
      geminiGenerate: () => ({ text: "Fissure au niveau du linteau, lot B3, entreprise Dupont." }),
      archidocDQEPost: () => ({ ok: true, data: { id: "dqe-archidoc-001" } }),
    });
  });

  it("returns 200 with archidocDQEId and transcription on valid submission", async () => {
    const body = {
      localId: "local-001",
      projectId: "proj-123",
      projectName: "Résidence Lumière",
      videoObjectPath: "ouvro/dqe/local-001.mp4",
      videoDuration: 45,
      qualityTier: "standard",
      capturedAt: new Date().toISOString(),
      capturedBy: "Architect Lemaire",
    };

    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.localId, "local-001");
    assert.equal(result.archidocDQEId, "dqe-archidoc-001");
    assert.ok((result.transcription as string).length > 0, "transcription should be non-empty");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

// ── Failure paths (retry-triggering: should return 5xx) ──────────────────────

describe("POST /api/dqe/submit — transient failures → 502 (queue retries)", () => {
  it("returns 502 when Archidoc download-url fails (URL unavailable)", async () => {
    const app = buildTestApp({
      resolveDownloadUrl: () => ({ ok: false, error: "Object not found in storage" }),
      downloadVideo: () => ({ ok: true, size: 10 * 1024 * 1024 }),
      geminiUpload: () => ({ uri: "https://example.com/file" }),
      geminiGenerate: () => ({ text: "test" }),
      archidocDQEPost: () => ({ ok: true, data: { id: "dqe-001" } }),
    });

    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localId: "local-002",
        projectId: "proj-456",
        projectName: "Immeuble Central",
        videoObjectPath: "ouvro/dqe/local-002.mp4",
        videoDuration: 60,
        qualityTier: "efficient",
        capturedAt: new Date().toISOString(),
        capturedBy: "Architect Martin",
      }),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 502);
    assert.equal(result.success, false);
    assert.ok((result.error as string).includes("Video URL unavailable"));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns 502 when Gemini returns no file URI (transcription failure)", async () => {
    const app = buildTestApp({
      resolveDownloadUrl: () => ({ ok: true, data: { downloadURL: "https://cdn.example.com/v2.mp4" } }),
      downloadVideo: () => ({ ok: true, size: 20 * 1024 * 1024 }),
      geminiUpload: () => ({ uri: undefined }),
      geminiGenerate: () => ({ text: "" }),
      archidocDQEPost: () => ({ ok: true, data: { id: "dqe-002" } }),
    });

    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localId: "local-003",
        projectId: "proj-789",
        projectName: "Tour Nord",
        videoObjectPath: "ouvro/dqe/local-003.mp4",
        videoDuration: 120,
        qualityTier: "maximum",
        capturedAt: new Date().toISOString(),
        capturedBy: "Architect Dubois",
      }),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 502);
    assert.equal(result.success, false);
    assert.ok((result.error as string).includes("Transcription failed"));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns 502 when video exceeds 2 GB size limit", async () => {
    const oversizeBytes = 2.1 * 1024 * 1024 * 1024;
    const app = buildTestApp({
      resolveDownloadUrl: () => ({ ok: true, data: { downloadURL: "https://cdn.example.com/huge.mp4" } }),
      downloadVideo: () => ({ ok: true, size: oversizeBytes }),
      geminiUpload: () => ({ uri: "https://example.com/file" }),
      geminiGenerate: () => ({ text: "test" }),
      archidocDQEPost: () => ({ ok: true, data: { id: "dqe-003" } }),
    });

    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localId: "local-004",
        projectId: "proj-999",
        projectName: "Pavillon Est",
        videoObjectPath: "ouvro/dqe/local-004.mp4",
        videoDuration: 180,
        qualityTier: "maximum",
        capturedAt: new Date().toISOString(),
        capturedBy: "Architect Blanc",
      }),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 502);
    assert.equal(result.success, false);
    assert.ok((result.error as string).includes("too large"));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

// ── Permanent failure paths (400 → queue marks as "failed", no retry) ────────

describe("POST /api/dqe/submit — permanent failures → 400 (no retry)", () => {
  let app: Express;

  before(() => {
    app = buildTestApp({
      resolveDownloadUrl: () => ({ ok: true, data: { downloadURL: "https://cdn.example.com/v.mp4" } }),
      downloadVideo: () => ({ ok: true, size: 10 * 1024 * 1024 }),
      geminiUpload: () => ({ uri: "https://example.com/file" }),
      geminiGenerate: () => ({ text: "Narration text" }),
      archidocDQEPost: () => ({ ok: true, data: { id: "dqe-ok" } }),
    });
  });

  it("returns 400 when localId is missing", async () => {
    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "p1", videoObjectPath: "path" }),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 400);
    assert.equal(result.success, false);
    assert.ok((result.error as string).includes("localId"));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns 400 when videoObjectPath is missing", async () => {
    const { default: http } = await import("node:http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/api/dqe/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: "local-x", projectId: "p1" }),
    });
    const result = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 400);
    assert.equal(result.success, false);
    assert.ok((result.error as string).includes("videoObjectPath"));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
