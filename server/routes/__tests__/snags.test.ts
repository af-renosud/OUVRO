/**
 * Integration tests for POST /api/snags/submit and defaultForwardToArchidoc.
 * Verifies snag forwarding URL, headers (Authorization + X-OUVRO-Client-Version),
 * and 4xx-vs-503 retry semantics.
 *
 * Run: npx tsx --test server/routes/__tests__/snags.test.ts
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { createSnagsRouter, defaultForwardToArchidoc } from "../snags.ts";
import type { SnagsRouterDeps } from "../snags.ts";
import type { Request, Response, NextFunction } from "express";

const VALID_BODY = {
  localId: "snag-local-001",
  projectId: "proj-123",
  projectName: "Résidence Lumière",
  type: "defaut",
  title: "Fissure mur porteur",
  description: "Fissure de 30cm sur le linteau",
  severity: "major",
  capturedAt: new Date().toISOString(),
  capturedBy: "Architect Lemaire",
  media: [
    {
      type: "photo",
      objectPath: "ouvro/snags/snag-001.jpg",
      fileName: "snag-001.jpg",
      mimeType: "image/jpeg",
      fileName: "snag-001.jpg",
    },
  ],
};

function buildApp(deps: SnagsRouterDeps) {
  const app = express();
  app.use(express.json());
  app.use("/api", createSnagsRouter(deps));
  return app;
}

async function withServer(
  deps: SnagsRouterDeps,
  fn: (port: number) => Promise<void>,
) {
  const server = http.createServer(buildApp(deps));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postSnag(
  port: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const res = await fetch(`http://localhost:${port}/api/snags/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json()) as Record<string, unknown>,
  };
}

const okValidate = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.locals.archidocApiUrl = "https://archidoc.test";
  next();
};

describe("POST /api/snags/submit — happy path forwards correctly", () => {
  it("returns 200 with archidocSnagId and forwards payload + clientVersion", async () => {
    let receivedUrl = "";
    let receivedPayload: Record<string, unknown> = {};
    let receivedClientVersion = "";

    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async (url, payload, clientVersion) => {
        receivedUrl = url;
        receivedPayload = payload;
        receivedClientVersion = clientVersion;
        return { data: { id: "snag-archidoc-xyz", deepLink: "ouvro://snag/xyz" } };
      },
    };

    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, VALID_BODY, {
        "X-OUVRO-Client-Version": "1.4.2",
      });
      assert.equal(status, 200, `expected 200, got ${status}: ${data.error}`);
      assert.equal(data.success, true);
      assert.equal(data.localId, VALID_BODY.localId);
      assert.equal(data.archidocSnagId, "snag-archidoc-xyz");
      assert.equal(data.deepLink, "ouvro://snag/xyz");
      assert.equal(receivedUrl, "https://archidoc.test");
      assert.equal(receivedClientVersion, "1.4.2");
      assert.equal(receivedPayload.localId, VALID_BODY.localId);
      assert.equal(receivedPayload.projectId, VALID_BODY.projectId);
      assert.equal(receivedPayload.title, VALID_BODY.title);
      assert.equal(receivedPayload.severity, "major");
      assert.ok(Array.isArray(receivedPayload.media));
    });
  });

  it("defaults clientVersion to 'unknown' when header is absent", async () => {
    let receivedClientVersion = "";
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async (_url, _payload, clientVersion) => {
        receivedClientVersion = clientVersion;
        return { data: { id: "snag-1" } };
      },
    };
    await withServer(deps, async (port) => {
      const { status } = await postSnag(port, VALID_BODY);
      assert.equal(status, 200);
      assert.equal(receivedClientVersion, "unknown");
    });
  });

  it("forwards Archidoc 'duplicate: true' flag back to the client", async () => {
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => ({
        data: {
          id: "snag-archidoc-xyz",
          deepLink: "https://archidoc.test/projects/p/snags/xyz",
          duplicate: true,
        },
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, VALID_BODY);
      assert.equal(status, 200);
      assert.equal(data.duplicate, true);
      assert.equal(data.archidocSnagId, "snag-archidoc-xyz");
    });
  });

  it("accepts an empty media array (contract allows media: [])", async () => {
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async (_url, payload) => {
        assert.ok(Array.isArray(payload.media));
        assert.equal((payload.media as unknown[]).length, 0);
        return { data: { id: "snag-empty-media" } };
      },
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, { ...VALID_BODY, media: [] });
      assert.equal(status, 200, `expected 200, got ${status}: ${data.error}`);
      assert.equal(data.archidocSnagId, "snag-empty-media");
    });
  });

  it("rejects media items missing fileName with 400 VALIDATION_FAILED", async () => {
    let forwarded = false;
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => {
        forwarded = true;
        return { data: { id: "should-not-happen" } };
      },
    };
    await withServer(deps, async (port) => {
      const body = {
        ...VALID_BODY,
        media: [
          { type: "photo", objectPath: "ouvro/snags/x.jpg", mimeType: "image/jpeg" },
        ],
      };
      const { status, data } = await postSnag(port, body);
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
      assert.match(String(data.error), /fileName/);
      assert.equal(forwarded, false, "must not forward when validation fails");
    });
  });

  it("rejects whitespace-only title with 400 VALIDATION_FAILED", async () => {
    let forwarded = false;
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => {
        forwarded = true;
        return { data: { id: "should-not-happen" } };
      },
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, { ...VALID_BODY, title: "   " });
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
      assert.match(String(data.error), /title/);
      assert.equal(forwarded, false, "must not forward when validation fails");
    });
  });
});

describe("POST /api/snags/submit — 4xx permanent failure semantics", () => {
  it("propagates 4xx status from Archidoc as permanent failure", async () => {
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => ({
        error: "Failed to submit snag to ArchiDoc",
        status: 400,
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, VALID_BODY);
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.equal(data.localId, VALID_BODY.localId);
      assert.ok((data.error as string).toLowerCase().includes("snag"));
    });
  });

  it("propagates parsed Archidoc error code + message from upstream JSON body", async () => {
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => ({
        error: "Project not found in ARCHIDOC",
        status: 400,
        code: "PROJECT_NOT_FOUND",
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, VALID_BODY);
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.equal(data.code, "PROJECT_NOT_FOUND");
      assert.equal(data.error, "Project not found in ARCHIDOC");
    });
  });

  it("returns 400 for invalid type (validation failure before forward)", async () => {
    let forwardCalled = false;
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => {
        forwardCalled = true;
        return { data: {} };
      },
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, {
        ...VALID_BODY,
        type: "invalid_type",
      });
      assert.equal(status, 400);
      assert.equal(data.success, false);
      assert.equal(forwardCalled, false, "forward must not be called on validation failure");
    });
  });
});

describe("POST /api/snags/submit — 503 transient failure semantics", () => {
  it("returns 503 with FEATURE_DISABLED code when Archidoc returns 503", async () => {
    const deps: SnagsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardToArchidoc: async () => ({
        error: "Snag intake is not enabled on this Archidoc instance",
        status: 503,
        code: "FEATURE_DISABLED",
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postSnag(port, VALID_BODY);
      assert.equal(status, 503);
      assert.equal(data.success, false);
      assert.equal(data.code, "FEATURE_DISABLED");
      assert.equal(data.localId, VALID_BODY.localId);
    });
  });
});

describe("defaultForwardToArchidoc — URL, headers, and retry semantics", () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string | string[] | undefined> = {};
  let capturedBody = "";
  let nextStatus = 200;
  let nextResponseBody: string = JSON.stringify({ id: "snag-remote-1" });
  let captureServer: http.Server;
  let capturePort: number;

  before(async () => {
    captureServer = http.createServer((req, res) => {
      capturedUrl = req.url || "";
      capturedMethod = req.method || "";
      capturedHeaders = Object.assign({}, req.headers);
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        capturedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(nextStatus, { "Content-Type": "application/json" });
        res.end(nextResponseBody);
      });
    });
    await new Promise<void>((resolve) => captureServer.listen(0, resolve));
    capturePort = (captureServer.address() as { port: number }).port;
  });

  after(async () => {
    await new Promise<void>((resolve) => captureServer.close(() => resolve()));
  });

  beforeEach(() => {
    capturedUrl = "";
    capturedMethod = "";
    capturedHeaders = {};
    capturedBody = "";
    nextStatus = 200;
    nextResponseBody = JSON.stringify({ id: "snag-remote-1" });
    delete process.env.OUVRO_API_KEY;
  });

  it("POSTs to /api/ouvro/snags with both Authorization and X-OUVRO-Client-Version headers", async () => {
    process.env.OUVRO_API_KEY = "secret-snag-key-xyz";
    const result = await defaultForwardToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "fwd-1", projectId: "p1" },
      "2.0.7",
    );
    assert.ok(
      !("error" in result),
      `Expected success, got: ${"error" in result ? result.error : ""}`,
    );
    assert.equal(capturedMethod, "POST");
    assert.equal(capturedUrl, "/api/ouvro/snags");
    assert.equal(
      capturedHeaders["authorization"],
      "Bearer secret-snag-key-xyz",
      "Authorization must be Bearer {OUVRO_API_KEY}",
    );
    assert.equal(
      capturedHeaders["x-ouvro-client-version"],
      "2.0.7",
      "X-OUVRO-Client-Version header must be forwarded",
    );
    assert.equal(capturedHeaders["content-type"], "application/json");
    const sent = JSON.parse(capturedBody) as Record<string, unknown>;
    assert.equal(sent.localId, "fwd-1");
    assert.equal(sent.projectId, "p1");
  });

  it("omits Authorization header when OUVRO_API_KEY is unset; still sends client version", async () => {
    const result = await defaultForwardToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "fwd-2" },
      "3.1.0",
    );
    assert.ok(!("error" in result));
    assert.equal(
      capturedHeaders["authorization"],
      undefined,
      "Authorization header must be absent when OUVRO_API_KEY is unset",
    );
    assert.equal(
      capturedHeaders["x-ouvro-client-version"],
      "3.1.0",
    );
  });

  it("returns 4xx error verbatim (permanent failure, no retry)", async () => {
    nextStatus = 400;
    nextResponseBody = JSON.stringify({ error: "bad request" });
    const result = await defaultForwardToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "fwd-3" },
      "1.0.0",
    );
    assert.ok("error" in result, "expected an error result");
    if ("error" in result) {
      assert.equal(result.status, 400);
      assert.notEqual(
        result.code,
        "FEATURE_DISABLED",
        "4xx must not be tagged FEATURE_DISABLED",
      );
      assert.ok(
        typeof result.error === "string" && result.error.length > 0,
        `expected a non-empty error message, got: ${result.error}`,
      );
    }
  });

  it("returns 503 with FEATURE_DISABLED code (transient, retry-eligible)", async () => {
    nextStatus = 503;
    nextResponseBody = "Service unavailable";
    const result = await defaultForwardToArchidoc(
      `http://localhost:${capturePort}`,
      { localId: "fwd-4" },
      "1.0.0",
    );
    assert.ok("error" in result, "expected an error result");
    if ("error" in result) {
      assert.equal(result.status, 503);
      assert.equal(result.code, "FEATURE_DISABLED");
    }
  });
});
