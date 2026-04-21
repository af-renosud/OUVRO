/**
 * Integration tests for POST /api/uploads/request-url and defaultForwardUploadUrl.
 * Verifies the BFF proxy injects Authorization: Bearer when OUVRO_API_KEY is set,
 * forwards the {name, contentType, size} payload verbatim, and surfaces upstream
 * errors with their status code.
 *
 * Run: npx tsx --test server/routes/__tests__/uploads.test.ts
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import {
  createUploadsRouter,
  defaultForwardUploadUrl,
} from "../uploads.ts";
import type { UploadsRouterDeps } from "../uploads.ts";
import type { Request, Response, NextFunction } from "express";

const VALID_BODY = {
  name: "smoke-test.jpg",
  contentType: "image/jpeg",
  size: 1024,
};

function buildApp(deps: UploadsRouterDeps) {
  const app = express();
  app.use(express.json());
  app.use("/api", createUploadsRouter(deps));
  return app;
}

async function withServer(
  deps: UploadsRouterDeps,
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

async function postUploadUrl(port: number, body: unknown) {
  const res = await fetch(`http://localhost:${port}/api/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

describe("POST /api/uploads/request-url — happy path forwards correctly", () => {
  it("returns 200 with upload URL fields and forwards payload verbatim", async () => {
    let receivedUrl = "";
    let receivedPayload: { name: string; contentType: string; size: number } = {
      name: "",
      contentType: "",
      size: 0,
    };

    const deps: UploadsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardUploadUrl: async (url, payload) => {
        receivedUrl = url;
        receivedPayload = payload;
        return {
          data: {
            uploadURL: "https://signed-url.example/put",
            objectPath: "ouvro/uploads/abc123.jpg",
          },
        };
      },
    };

    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, VALID_BODY);
      assert.equal(status, 200);
      assert.equal(data.uploadURL, "https://signed-url.example/put");
      assert.equal(data.objectPath, "ouvro/uploads/abc123.jpg");
      assert.equal(receivedUrl, "https://archidoc.test");
      assert.deepEqual(receivedPayload, VALID_BODY);
    });
  });
});

describe("POST /api/uploads/request-url — validation failures", () => {
  const deps: UploadsRouterDeps = {
    validateArchidocUrl: okValidate,
    forwardUploadUrl: async () => {
      throw new Error("forward should not be called when validation fails");
    },
  };

  it("rejects missing name with 400 + VALIDATION_FAILED", async () => {
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, {
        contentType: "image/jpeg",
        size: 1,
      });
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
    });
  });

  it("rejects missing contentType with 400 + VALIDATION_FAILED", async () => {
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, {
        name: "x.jpg",
        size: 1,
      });
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
    });
  });

  it("rejects non-numeric size with 400 + VALIDATION_FAILED", async () => {
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, {
        name: "x.jpg",
        contentType: "image/jpeg",
        size: "not-a-number",
      });
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
    });
  });

  it("rejects negative size with 400 + VALIDATION_FAILED", async () => {
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, {
        name: "x.jpg",
        contentType: "image/jpeg",
        size: -5,
      });
      assert.equal(status, 400);
      assert.equal(data.code, "VALIDATION_FAILED");
    });
  });
});

describe("POST /api/uploads/request-url — upstream error passthrough", () => {
  it("surfaces upstream 401 with code so callers can react", async () => {
    const deps: UploadsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardUploadUrl: async () => ({
        error: "Unauthorized",
        status: 401,
        code: "UNAUTHORIZED",
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, VALID_BODY);
      assert.equal(status, 401);
      assert.equal(data.code, "UNAUTHORIZED");
      assert.equal(data.error, "Unauthorized");
    });
  });

  it("surfaces upstream 5xx for callers to retry", async () => {
    const deps: UploadsRouterDeps = {
      validateArchidocUrl: okValidate,
      forwardUploadUrl: async () => ({
        error: "Upstream down",
        status: 502,
      }),
    };
    await withServer(deps, async (port) => {
      const { status, data } = await postUploadUrl(port, VALID_BODY);
      assert.equal(status, 502);
      assert.equal(data.error, "Upstream down");
    });
  });
});

describe("defaultForwardUploadUrl — URL, headers, and bearer semantics", () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string | string[] | undefined> = {};
  let capturedBody = "";
  let nextStatus = 200;
  let nextResponseBody: string = JSON.stringify({
    uploadURL: "https://signed.example/put",
    objectPath: "ouvro/uploads/x.jpg",
  });
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
    nextResponseBody = JSON.stringify({
      uploadURL: "https://signed.example/put",
      objectPath: "ouvro/uploads/x.jpg",
    });
    delete process.env.OUVRO_API_KEY;
    delete process.env.NODE_ENV;
  });

  it("POSTs to /api/uploads/request-url with Authorization Bearer when OUVRO_API_KEY is set", async () => {
    process.env.OUVRO_API_KEY = "secret-upload-key-abc";
    const result = await defaultForwardUploadUrl(
      `http://localhost:${capturePort}`,
      { name: "x.jpg", contentType: "image/jpeg", size: 99 },
    );
    assert.ok(
      !("error" in result),
      `Expected success, got: ${"error" in result ? result.error : ""}`,
    );
    assert.equal(capturedMethod, "POST");
    assert.equal(capturedUrl, "/api/uploads/request-url");
    assert.equal(
      capturedHeaders["authorization"],
      "Bearer secret-upload-key-abc",
      "Authorization must be Bearer {OUVRO_API_KEY}",
    );
    assert.equal(capturedHeaders["content-type"], "application/json");
    const sent = JSON.parse(capturedBody) as Record<string, unknown>;
    assert.equal(sent.name, "x.jpg");
    assert.equal(sent.contentType, "image/jpeg");
    assert.equal(sent.size, 99);
  });

  it("omits Authorization header when OUVRO_API_KEY is unset (development mode)", async () => {
    const result = await defaultForwardUploadUrl(
      `http://localhost:${capturePort}`,
      { name: "x.jpg", contentType: "image/jpeg", size: 1 },
    );
    assert.ok(!("error" in result));
    assert.equal(
      capturedHeaders["authorization"],
      undefined,
      "Authorization header must be absent when OUVRO_API_KEY is unset",
    );
  });

  it("refuses to forward in production when OUVRO_API_KEY is missing", async () => {
    process.env.NODE_ENV = "production";
    const result = await defaultForwardUploadUrl(
      `http://localhost:${capturePort}`,
      { name: "x.jpg", contentType: "image/jpeg", size: 1 },
    );
    assert.ok("error" in result, "Expected refusal error");
    if ("error" in result) {
      assert.equal(result.status, 500);
      assert.equal(result.code, "MISSING_API_KEY");
    }
  });

  it("returns upstream error code+message when Archidoc rejects (e.g. 401 post-enforcement)", async () => {
    process.env.OUVRO_API_KEY = "wrong-key";
    nextStatus = 401;
    nextResponseBody = JSON.stringify({
      error: "UNAUTHORIZED",
      message: "Invalid bearer token",
    });
    const result = await defaultForwardUploadUrl(
      `http://localhost:${capturePort}`,
      { name: "x.jpg", contentType: "image/jpeg", size: 1 },
    );
    assert.ok("error" in result);
    if ("error" in result) {
      assert.equal(result.status, 401);
      assert.equal(result.code, "UNAUTHORIZED");
      assert.equal(result.error, "Invalid bearer token");
    }
  });
});
