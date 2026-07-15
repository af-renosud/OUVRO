/**
 * Integration tests for the Contractors BFF proxy.
 * Covers mock-mode list and live-mode forwarding (auth guard + error mapping).
 *
 * Run: npx tsx --test server/routes/__tests__/contractors.test.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import {
  createContractorsRouter,
  type ContractorsRouterDeps,
  type ContractorWire,
} from "../contractors.ts";
import type { Request, Response, NextFunction } from "express";

function buildApp(deps: ContractorsRouterDeps) {
  const app = express();
  app.use(express.json());
  app.use("/api", createContractorsRouter(deps));
  return app;
}

async function withServer(
  deps: ContractorsRouterDeps,
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

const okValidate = (_req: Request, res: Response, next: NextFunction) => {
  res.locals.archidocApiUrl = "https://archidoc.test";
  next();
};

describe("Contractors BFF — mock mode (default)", () => {
  beforeEach(() => {
    delete process.env.CONTRACTORS_MODE;
  });

  it("GET returns a non-empty seeded contractor list", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(`http://localhost:${port}/api/contractors`);
      assert.equal(res.status, 200);
      const data = (await res.json()) as { contractors: ContractorWire[] };
      assert.ok(Array.isArray(data.contractors));
      assert.ok(data.contractors.length >= 3);
      for (const c of data.contractors) {
        assert.equal(typeof c.id, "string");
        assert.equal(typeof c.name, "string");
        assert.ok(c.name.length > 0);
      }
    });
  });
});

describe("Contractors BFF — live mode", () => {
  beforeEach(() => {
    process.env.CONTRACTORS_MODE = "live";
  });

  afterEach(() => {
    delete process.env.CONTRACTORS_MODE;
  });

  it("forwards the ARCHIDOC list result", async () => {
    const wire: ContractorWire[] = [
      { id: "c1", name: "Entreprise Alpha", town: "Nîmes" },
    ];
    await withServer(
      {
        validateArchidocUrl: okValidate,
        listLive: async (url) => {
          assert.equal(url, "https://archidoc.test");
          return { data: { contractors: wire } };
        },
      },
      async (port) => {
        const res = await fetch(`http://localhost:${port}/api/contractors`);
        assert.equal(res.status, 200);
        const data = (await res.json()) as { contractors: ContractorWire[] };
        assert.deepEqual(data.contractors, wire);
      },
    );
  });

  it("maps upstream errors to the same status with a JSON error body", async () => {
    await withServer(
      {
        validateArchidocUrl: okValidate,
        listLive: async () => ({ error: "Failed to load contractors", status: 502 }),
      },
      async (port) => {
        const res = await fetch(`http://localhost:${port}/api/contractors`);
        assert.equal(res.status, 502);
        const data = (await res.json()) as { error: string };
        assert.equal(data.error, "Failed to load contractors");
      },
    );
  });

  it("returns 503 when ARCHIDOC URL is not configured", async () => {
    const noUrlValidate = (_req: Request, res: Response, _next: NextFunction) => {
      res
        .status(503)
        .json({ success: false, error: "ARCHIDOC API URL not configured. Service unavailable." });
    };
    await withServer(
      { validateArchidocUrl: noUrlValidate },
      async (port) => {
        const res = await fetch(`http://localhost:${port}/api/contractors`);
        assert.equal(res.status, 503);
      },
    );
  });

  it("injects Authorization: Bearer OUVRO_API_KEY on the outbound ARCHIDOC request", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.OUVRO_API_KEY;
    process.env.OUVRO_API_KEY = "test-secret-key";
    let capturedUrl = "";
    let capturedAuth: string | null = null;
    let capturedContentType: string | null = null;
    globalThis.fetch = (async (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.startsWith("http://localhost:")) {
        return originalFetch(input as never, init);
      }
      capturedUrl = url;
      const headers = new Headers(init?.headers);
      capturedAuth = headers.get("authorization");
      capturedContentType = headers.get("content-type");
      return new Response(JSON.stringify({ contractors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    try {
      await withServer(
        { validateArchidocUrl: okValidate },
        async (port) => {
          const res = await fetch(`http://localhost:${port}/api/contractors`);
          assert.equal(res.status, 200);
          assert.equal(capturedUrl, "https://archidoc.test/api/ouvro/contractors");
          assert.equal(capturedAuth, "Bearer test-secret-key");
          assert.equal(capturedContentType, "application/json");
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OUVRO_API_KEY;
      else process.env.OUVRO_API_KEY = originalKey;
    }
  });

  it("returns 500 and never forwards when OUVRO_API_KEY is missing", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.OUVRO_API_KEY;
    delete process.env.OUVRO_API_KEY;
    let outboundCalled = false;
    globalThis.fetch = (async (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.startsWith("http://localhost:")) {
        return originalFetch(input as never, init);
      }
      outboundCalled = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await withServer(
        { validateArchidocUrl: okValidate },
        async (port) => {
          const res = await originalFetch(`http://localhost:${port}/api/contractors`);
          assert.equal(res.status, 500);
          const data = (await res.json()) as { error: string };
          assert.match(data.error, /misconfigured/i);
          assert.match(data.error, /OUVRO_API_KEY/);
          assert.equal(outboundCalled, false);
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OUVRO_API_KEY;
      else process.env.OUVRO_API_KEY = originalKey;
    }
  });

  it("surfaces a thrown listLive failure as a formatted 5xx", async () => {
    await withServer(
      {
        validateArchidocUrl: okValidate,
        listLive: async () => {
          throw new Error("ARCHIDOC request timed out after 15s: https://archidoc.test/api/ouvro/contractors");
        },
      },
      async (port) => {
        const res = await fetch(`http://localhost:${port}/api/contractors`);
        assert.equal(res.status, 504);
        const data = (await res.json()) as { error: string };
        assert.ok(data.error.length > 0);
      },
    );
  });
});
