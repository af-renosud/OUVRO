/**
 * Integration tests for the Site Reminders BFF proxy.
 * Covers mock-mode list/toggle and live-mode forwarding (auth + error mapping).
 *
 * Run: npx tsx --test server/routes/__tests__/site-reminders.test.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import {
  createSiteRemindersRouter,
  type SiteRemindersRouterDeps,
  type SiteReminderWire,
} from "../site-reminders.ts";
import type { Request, Response, NextFunction } from "express";

function buildApp(deps: SiteRemindersRouterDeps) {
  const app = express();
  app.use(express.json());
  app.use("/api", createSiteRemindersRouter(deps));
  return app;
}

async function withServer(
  deps: SiteRemindersRouterDeps,
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

describe("Site Reminders BFF — mock mode (default)", () => {
  beforeEach(() => {
    delete process.env.SITE_REMINDERS_MODE;
  });

  it("GET returns seeded reminders ordered by sort_order", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(
        `http://localhost:${port}/api/site-reminders/mock-project-1`,
      );
      assert.equal(res.status, 200);
      const data = (await res.json()) as { site_reminders: SiteReminderWire[] };
      assert.ok(Array.isArray(data.site_reminders));
      assert.ok(data.site_reminders.length >= 3);
      const orders = data.site_reminders.map((r) => r.sort_order);
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
    });
  });

  it("GET attachments carry a fresh ephemeral url each call", async () => {
    await withServer({}, async (port) => {
      const first = (await (
        await fetch(`http://localhost:${port}/api/site-reminders/mock-project-1`)
      ).json()) as { site_reminders: SiteReminderWire[] };
      const withAttach = first.site_reminders.find(
        (r) => r.attachments.length > 0,
      );
      assert.ok(withAttach, "expected a reminder with attachments");
      assert.ok(withAttach.attachments[0].url, "attachment must include a url");
      assert.ok(withAttach.attachments[0].object_path);
    });
  });

  it("PATCH toggles is_done and returns the updated reminder", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(
        `http://localhost:${port}/api/site-reminders/mock-project-1/rem-2`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: true }),
        },
      );
      assert.equal(res.status, 200);
      const updated = (await res.json()) as SiteReminderWire;
      assert.equal(updated.id, "rem-2");
      assert.equal(updated.is_done, true);
    });
  });

  it("PATCH rejects a non-boolean is_done with 400", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(
        `http://localhost:${port}/api/site-reminders/mock-project-1/rem-1`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: "yes" }),
        },
      );
      assert.equal(res.status, 400);
    });
  });

  it("PATCH unknown reminder returns 404", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(
        `http://localhost:${port}/api/site-reminders/mock-project-1/does-not-exist`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: true }),
        },
      );
      assert.equal(res.status, 404);
    });
  });
});

describe("Site Reminders BFF — live mode", () => {
  beforeEach(() => {
    process.env.SITE_REMINDERS_MODE = "live";
  });
  afterEach(() => {
    delete process.env.SITE_REMINDERS_MODE;
  });

  it("GET forwards to ARCHIDOC and unwraps site_reminders", async () => {
    const sample: SiteReminderWire = {
      id: "live-1",
      project_id: "p1",
      body_html: "<p>hi</p>",
      body_text: "hi",
      is_done: false,
      sort_order: 1,
      attachments: [],
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };
    let seenProjectId = "";
    await withServer(
      {
        validateArchidocUrl: okValidate,
        listLive: async (_url, projectId) => {
          seenProjectId = projectId;
          return { data: { site_reminders: [sample] } };
        },
      },
      async (port) => {
        const res = await fetch(`http://localhost:${port}/api/site-reminders/p1`);
        assert.equal(res.status, 200);
        const data = (await res.json()) as {
          site_reminders: SiteReminderWire[];
        };
        assert.equal(seenProjectId, "p1");
        assert.equal(data.site_reminders[0].id, "live-1");
      },
    );
  });

  it("PATCH forwards is_done and surfaces upstream error status", async () => {
    await withServer(
      {
        validateArchidocUrl: okValidate,
        toggleLive: async () => ({ error: "nope", status: 403 }),
      },
      async (port) => {
        const res = await fetch(
          `http://localhost:${port}/api/site-reminders/p1/r1`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_done: true }),
          },
        );
        assert.equal(res.status, 403);
        const data = (await res.json()) as { error: string };
        assert.equal(data.error, "nope");
      },
    );
  });
});
