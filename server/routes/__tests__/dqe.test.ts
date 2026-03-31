/**
 * Integration tests for POST /api/dqe/submit.
 * Mounts the real createDQERouter with injected mock deps.
 * Run: npx tsx --test server/routes/__tests__/dqe.test.ts
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { createDQERouter, defaultSubmitToArchidoc } from "../dqe.ts";
import type { DQERouterDeps } from "../dqe.ts";
import type { Request, Response, NextFunction } from "express";

const state = {
  downloadUrlOk: true,
  downloadUrlError: "Object not found in storage",
  videoSizeBytes: 50 * 1024 * 1024,
  transcribeOk: true,
  transcribeText: "Fissure au niveau du linteau, lot B3, entreprise Dupont.",
  dqePostOk: true,
  dqePostError: "Archidoc DQE engine unavailable",
  dqeRemoteId: "dqe-archidoc-001",
};

function resetState() {
  state.downloadUrlOk = true;
  state.videoSizeBytes = 50 * 1024 * 1024;
  state.transcribeOk = true;
  state.dqePostOk = true;
}

const mockDeps: DQERouterDeps = {
  validateArchidocUrl: (_req: Request, res: Response, next: NextFunction) => {
    res.locals.archidocApiUrl = "https://archidoc.test";
    next();
  },

  fetchVideoDownloadUrl: async (_apiUrl: string, _objectPath: string) => {
    if (!state.downloadUrlOk) throw new Error(state.downloadUrlError);
    return "https://cdn.test/video.mp4";
  },

  transcribeVideo: async (_videoUrl: string, _mimeType: string) => {
    if (!state.transcribeOk) {
      if (state.videoSizeBytes > 2 * 1024 * 1024 * 1024) {
        throw new Error(
          `Video too large for transcription: ${Math.round(state.videoSizeBytes / 1024 / 1024)} MB exceeds 2 GB limit`,
        );
      }
      throw new Error("Gemini Files API returned no URI for uploaded video");
    }
    return state.transcribeText;
  },

  submitToArchidoc: async (
    _apiUrl: string,
    _payload: Record<string, unknown>,
  ) => {
    if (!state.dqePostOk) return { error: state.dqePostError, status: 503 };
    return { data: { id: state.dqeRemoteId } };
  },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", createDQERouter(mockDeps));
  return app;
}

async function withServer(fn: (port: number) => Promise<void>) {
  const server = http.createServer(buildApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function post(port: number, body: unknown) {
  const res = await fetch(`http://localhost:${port}/api/dqe/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json()) as Record<string, unknown>,
  };
}

const VALID_BODY = {
  localId: "local-001",
  projectId: "proj-123",
  projectName: "Résidence Lumière",
  videoObjectPath: "ouvro/dqe/local-001.mp4",
  videoDuration: 45,
  qualityTier: "standard",
  capturedAt: new Date().toISOString(),
  capturedBy: "Architect Lemaire",
};

describe("POST /api/dqe/submit — permanent failures → 400", () => {
  beforeEach(() => resetState());

  it("returns 400 when localId is absent", async () => {
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        projectId: "p1",
        videoObjectPath: "path",
      });
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).includes("localId"),
        `got: ${data.error}`,
      );
    });
  });

  it("returns 400 when projectId is absent", async () => {
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        localId: "local-x",
        videoObjectPath: "path",
      });
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).includes("projectId"),
        `got: ${data.error}`,
      );
    });
  });

  it("returns 400 when videoObjectPath is absent", async () => {
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        localId: "local-x",
        projectId: "p1",
      });
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).includes("videoObjectPath"),
        `got: ${data.error}`,
      );
    });
  });
});

describe("POST /api/dqe/submit — happy path → 200", () => {
  before(() => resetState());

  it("returns 200 with archidocDQEId and non-empty transcription", async () => {
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        ...VALID_BODY,
        localId: "local-happy",
      });
      assert.equal(status, 200, `expected 200, got ${status}: ${data.error}`);
      assert.equal(data.success, true);
      assert.equal(data.localId, "local-happy");
      assert.equal(data.archidocDQEId, state.dqeRemoteId);
      assert.equal(data.transcription, state.transcribeText);
    });
  });
});

describe("POST /api/dqe/submit — transient failures → 502", () => {
  beforeEach(() => resetState());

  it("returns 502 when Archidoc download-url resolution fails", async () => {
    state.downloadUrlOk = false;
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        ...VALID_BODY,
        localId: "local-urlFail",
      });
      assert.equal(status, 502);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).toLowerCase().includes("url") ||
          (data.error as string).toLowerCase().includes("unavailable"),
        `got: ${data.error}`,
      );
    });
  });

  it("returns 502 when Gemini transcription fails", async () => {
    state.transcribeOk = false;
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        ...VALID_BODY,
        localId: "local-transcribeFail",
      });
      assert.equal(status, 502);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).toLowerCase().includes("transcription"),
        `got: ${data.error}`,
      );
    });
  });

  it("returns 502 when video exceeds the 2 GB size guardrail", async () => {
    state.transcribeOk = false;
    state.videoSizeBytes = 2.1 * 1024 * 1024 * 1024;
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        ...VALID_BODY,
        localId: "local-tooBig",
      });
      assert.equal(status, 502);
      assert.equal(data.success, false);
      assert.ok(
        (data.error as string).toLowerCase().includes("large") ||
          (data.error as string).toLowerCase().includes("transcription"),
        `got: ${data.error}`,
      );
    });
  });

  it("returns 502 when Archidoc DQE intake endpoint fails", async () => {
    state.dqePostOk = false;
    await withServer(async (port) => {
      const { status, data } = await post(port, {
        ...VALID_BODY,
        localId: "local-dqeFail",
      });
      assert.equal(status, 502);
      assert.equal(data.success, false);
    });
  });
});

describe("defaultSubmitToArchidoc — x-api-key header authentication", () => {
  let capturedHeaders: Record<string, string | string[] | undefined> = {};
  let captureServer: http.Server;
  let capturePort: number;

  before(async () => {
    captureServer = http.createServer((req, res) => {
      capturedHeaders = Object.assign({}, req.headers);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "dqe-key-test-001" }));
    });
    await new Promise<void>((resolve) => captureServer.listen(0, resolve));
    capturePort = (captureServer.address() as { port: number }).port;
  });

  after(async () => {
    await new Promise<void>((resolve) => captureServer.close(() => resolve()));
  });

  beforeEach(() => {
    capturedHeaders = {};
    delete process.env.OUVRO_API_KEY;
  });

  it("sends x-api-key header when OUVRO_API_KEY is set", async () => {
    process.env.OUVRO_API_KEY = "test-secret-key-abc";
    const result = await defaultSubmitToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "key-test-001", projectId: "proj-1" },
    );
    assert.ok(
      !("error" in result),
      `Expected success but got error: ${"error" in result ? result.error : ""}`,
    );
    assert.equal(
      capturedHeaders["x-api-key"],
      "test-secret-key-abc",
      "x-api-key header must equal OUVRO_API_KEY",
    );
  });

  it("omits x-api-key header when OUVRO_API_KEY is not set", async () => {
    const result = await defaultSubmitToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "key-test-002", projectId: "proj-2" },
    );
    assert.ok(
      !("error" in result),
      `Expected success but got error: ${"error" in result ? result.error : ""}`,
    );
    assert.equal(
      capturedHeaders["x-api-key"],
      undefined,
      "x-api-key header must be absent when OUVRO_API_KEY is unset",
    );
  });
});
