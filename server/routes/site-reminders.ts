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

/**
 * Site Reminders BFF proxy ("Points à vérifier").
 *
 * ARCHIDOC owns the data. The OUVRO-authenticated endpoints require the
 * server-side OUVRO_API_KEY as a Bearer token, so BOTH the read (list) and the
 * write (toggle is_done) are proxied through this BFF — the key must never reach
 * the mobile client. This mirrors the snags proxy.
 *
 * Modes:
 *   SITE_REMINDERS_MODE=live  → proxy to ARCHIDOC with Bearer OUVRO_API_KEY
 *   SITE_REMINDERS_MODE=mock  → in-memory seeded store (default while ARCHIDOC
 *                               has not deployed the endpoints yet)
 */

const SITE_REMINDERS_TIMEOUT_MS = 15_000;

function getMode(): "mock" | "live" {
  return process.env.SITE_REMINDERS_MODE === "live" ? "live" : "mock";
}

export type SiteReminderAttachmentWire = {
  object_path: string;
  file_name: string;
  content_type: string;
  url?: string;
};

export type SiteReminderWire = {
  id: string;
  project_id: string;
  body_html: string;
  body_text: string;
  is_done: boolean;
  sort_order: number;
  attachments: SiteReminderAttachmentWire[];
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

type MockReminder = Omit<SiteReminderWire, "attachments"> & {
  attachments: Array<Omit<SiteReminderAttachmentWire, "url">>;
};

const MOCK_NOW = "2026-06-15T08:00:00.000Z";

const mockStore = new Map<string, MockReminder[]>();

function seedMockStore(): void {
  if (mockStore.size > 0) return;
  mockStore.set("mock-project-1", [
    {
      id: "rem-1",
      project_id: "mock-project-1",
      body_html:
        "<p><strong>Vérifier l'étanchéité</strong> de la toiture terrasse, notamment aux relevés et naissances d'eau pluviale.</p>",
      body_text:
        "Vérifier l'étanchéité de la toiture terrasse, notamment aux relevés et naissances d'eau pluviale.",
      is_done: false,
      sort_order: 1,
      attachments: [
        {
          object_path: "ouvro/site-reminders/toiture-detail.jpg",
          file_name: "toiture-detail.jpg",
          content_type: "image/jpeg",
        },
      ],
      created_at: MOCK_NOW,
      updated_at: MOCK_NOW,
    },
    {
      id: "rem-2",
      project_id: "mock-project-1",
      body_html:
        "<p>Contrôler l'aplomb des <em>cloisons</em> du niveau R+2 et la planéité des supports avant pose du carrelage.</p>",
      body_text:
        "Contrôler l'aplomb des cloisons du niveau R+2 et la planéité des supports avant pose du carrelage.",
      is_done: false,
      sort_order: 2,
      attachments: [],
      created_at: MOCK_NOW,
      updated_at: MOCK_NOW,
    },
    {
      id: "rem-3",
      project_id: "mock-project-1",
      body_html:
        "<p>Réception des menuiseries extérieures : vérifier les calfeutrements et le bon fonctionnement des ouvrants.</p>",
      body_text:
        "Réception des menuiseries extérieures : vérifier les calfeutrements et le bon fonctionnement des ouvrants.",
      is_done: true,
      sort_order: 3,
      attachments: [
        {
          object_path: "ouvro/site-reminders/menuiserie-1.jpg",
          file_name: "menuiserie-1.jpg",
          content_type: "image/jpeg",
        },
        {
          object_path: "ouvro/site-reminders/menuiserie-2.jpg",
          file_name: "menuiserie-2.jpg",
          content_type: "image/jpeg",
        },
      ],
      created_at: MOCK_NOW,
      updated_at: "2026-06-16T14:30:00.000Z",
    },
  ]);
}

/**
 * Attachment `url` is short-lived. In mock mode we synthesize a fresh,
 * timestamped URL on every read to faithfully emulate the "re-fetch to refresh,
 * never persist the url" contract.
 */
function withFreshMockUrls(reminder: MockReminder): SiteReminderWire {
  const stamp = Date.now();
  return {
    ...reminder,
    attachments: reminder.attachments.map((a) => ({
      ...a,
      url: `https://picsum.photos/seed/${encodeURIComponent(
        a.object_path,
      )}/640/480?sig=${stamp}`,
    })),
  };
}

function mockList(projectId: string): SiteReminderWire[] {
  seedMockStore();
  const list = mockStore.get(projectId) ?? mockStore.get("mock-project-1") ?? [];
  return [...list]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(withFreshMockUrls);
}

function mockToggle(
  projectId: string,
  reminderId: string,
  isDone: boolean,
): SiteReminderWire | null {
  seedMockStore();
  const list = mockStore.get(projectId) ?? mockStore.get("mock-project-1");
  if (!list) return null;
  const found = list.find((r) => r.id === reminderId);
  if (!found) return null;
  found.is_done = isDone;
  found.updated_at = new Date().toISOString();
  return withFreshMockUrls(found);
}

// ---------------------------------------------------------------------------
// Live proxy
// ---------------------------------------------------------------------------

function buildAuthHeaders(clientVersion: string): Record<string, string> | null {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OUVRO-Client-Version": clientVersion,
  };
  const apiKey = process.env.OUVRO_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (process.env.NODE_ENV === "production") {
    return null;
  }
  return headers;
}

export type SiteRemindersRouterDeps = {
  listLive?: (
    archidocApiUrl: string,
    projectId: string,
    clientVersion: string,
  ) => Promise<
    | { data: { site_reminders: SiteReminderWire[] } }
    | { error: string; status: number }
  >;
  toggleLive?: (
    archidocApiUrl: string,
    projectId: string,
    reminderId: string,
    isDone: boolean,
    clientVersion: string,
  ) => Promise<
    { data: SiteReminderWire } | { error: string; status: number }
  >;
  validateArchidocUrl?: (
    req: Request,
    res: ExpressResponse,
    next: NextFunction,
  ) => void;
};

async function defaultListLive(
  archidocApiUrl: string,
  projectId: string,
  clientVersion: string,
): Promise<
  | { data: { site_reminders: SiteReminderWire[] } }
  | { error: string; status: number }
> {
  const headers = buildAuthHeaders(clientVersion);
  if (!headers) {
    return {
      error:
        "Server misconfigured: OUVRO_API_KEY is not set — refusing to forward unauthenticated request to ARCHIDOC",
      status: 500,
    };
  }
  const response = await archidocFetch(
    `${archidocApiUrl}/api/ouvro/projects/${encodeURIComponent(
      projectId,
    )}/site-reminders`,
    { method: "GET", headers, timeout: SITE_REMINDERS_TIMEOUT_MS },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[SiteReminders] ARCHIDOC list error (${response.status}):`, text);
    return { error: "Failed to load site reminders", status: response.status };
  }
  const data = (await response.json()) as { site_reminders?: SiteReminderWire[] };
  return { data: { site_reminders: data.site_reminders ?? [] } };
}

async function defaultToggleLive(
  archidocApiUrl: string,
  projectId: string,
  reminderId: string,
  isDone: boolean,
  clientVersion: string,
): Promise<{ data: SiteReminderWire } | { error: string; status: number }> {
  const headers = buildAuthHeaders(clientVersion);
  if (!headers) {
    return {
      error:
        "Server misconfigured: OUVRO_API_KEY is not set — refusing to forward unauthenticated request to ARCHIDOC",
      status: 500,
    };
  }
  const response = await archidocFetch(
    `${archidocApiUrl}/api/ouvro/projects/${encodeURIComponent(
      projectId,
    )}/site-reminders/${encodeURIComponent(reminderId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ is_done: isDone }),
      timeout: SITE_REMINDERS_TIMEOUT_MS,
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[SiteReminders] ARCHIDOC toggle error (${response.status}):`, text);
    return { error: "Failed to update site reminder", status: response.status };
  }
  const data = (await response.json()) as SiteReminderWire;
  return { data };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createSiteRemindersRouter(
  deps: SiteRemindersRouterDeps = {},
): Router {
  const effectiveValidate = deps.validateArchidocUrl ?? requireArchidocUrl;
  const effectiveList = deps.listLive ?? defaultListLive;
  const effectiveToggle = deps.toggleLive ?? defaultToggleLive;

  const router = Router();
  const liveGuards =
    getMode() === "live"
      ? [effectiveValidate]
      : [];

  router.get(
    "/site-reminders/:projectId",
    ...liveGuards,
    async (req: Request, res: ExpressResponse) => {
      const { projectId } = req.params;
      if (!projectId) {
        return res
          .status(400)
          .json({ error: "Missing required parameter: projectId" });
      }
      try {
        if (getMode() === "mock") {
          return res.status(200).json({ site_reminders: mockList(projectId) });
        }
        const archidocApiUrl: string = res.locals.archidocApiUrl;
        const clientVersion =
          (req.header("x-ouvro-client-version") as string) || "unknown";
        const result = await effectiveList(
          archidocApiUrl,
          projectId,
          clientVersion,
        );
        if ("error" in result) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(200).json(result.data);
      } catch (error: unknown) {
        const { status, message } = formatServerError(error, "Site Reminders List");
        return res.status(status).json({ error: message });
      }
    },
  );

  router.patch(
    "/site-reminders/:projectId/:reminderId",
    ...liveGuards,
    async (req: Request, res: ExpressResponse) => {
      const { projectId, reminderId } = req.params;
      const body = (req.body || {}) as { is_done?: unknown };
      if (!projectId || !reminderId) {
        return res
          .status(400)
          .json({ error: "Missing required parameter: projectId or reminderId" });
      }
      if (typeof body.is_done !== "boolean") {
        return res
          .status(400)
          .json({ error: "Field is_done (boolean) is required" });
      }
      const isDone = body.is_done;
      try {
        if (getMode() === "mock") {
          const updated = mockToggle(projectId, reminderId, isDone);
          if (!updated) {
            return res.status(404).json({ error: "Site reminder not found" });
          }
          return res.status(200).json(updated);
        }
        const archidocApiUrl: string = res.locals.archidocApiUrl;
        const clientVersion =
          (req.header("x-ouvro-client-version") as string) || "unknown";
        const result = await effectiveToggle(
          archidocApiUrl,
          projectId,
          reminderId,
          isDone,
          clientVersion,
        );
        if ("error" in result) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(200).json(result.data);
      } catch (error: unknown) {
        const { status, message } = formatServerError(
          error,
          "Site Reminders Toggle",
        );
        return res.status(status).json({ error: message });
      }
    },
  );

  return router;
}

export const siteRemindersRouter = createSiteRemindersRouter();
