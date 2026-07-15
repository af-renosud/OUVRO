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
 * Contractors BFF proxy ("Entreprises").
 *
 * ARCHIDOC owns the global contractor list. Its internal `/api/contractors`
 * endpoint is session-authenticated (returns 401 to the mobile client), so the
 * read is proxied through this BFF using the server-side OUVRO_API_KEY Bearer
 * token — the key must never reach the mobile client. This mirrors the Site
 * Reminders proxy.
 *
 * Modes:
 *   CONTRACTORS_MODE=auto  → (default) try ARCHIDOC `GET /api/ouvro/contractors`
 *                            with Bearer OUVRO_API_KEY. If ARCHIDOC responds
 *                            404 (route not deployed yet — verified missing on
 *                            2026-07-15), fall back to the seeded mock list so
 *                            the field UI never goes empty. As soon as ARCHIDOC
 *                            deploys the route, real data flows with no
 *                            redeploy needed. Any other upstream failure is
 *                            surfaced as an explicit error (no silent mock).
 *   CONTRACTORS_MODE=live  → proxy only; ARCHIDOC errors (incl. 404) surface.
 *   CONTRACTORS_MODE=mock  → in-memory seeded store only.
 */

const CONTRACTORS_TIMEOUT_MS = 15_000;

export type ContractorsMode = "mock" | "live" | "auto";

function getMode(): ContractorsMode {
  const mode = process.env.CONTRACTORS_MODE;
  if (mode === "live" || mode === "mock") return mode;
  return "auto";
}

export type ContractorWire = {
  id: string;
  name: string;
  address1?: string;
  town?: string;
  postcode?: string;
  siret?: string;
  contact_name?: string;
  contact_email?: string;
  contact_mobile?: string;
};

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const MOCK_CONTRACTORS: ContractorWire[] = [
  {
    id: "ent-1",
    name: "Batim Gros Œuvre",
    town: "Nîmes",
    postcode: "30000",
    contact_name: "Karim Belaïd",
  },
  {
    id: "ent-2",
    name: "Électricité Cévenole",
    town: "Alès",
    postcode: "30100",
    contact_name: "Sophie Durand",
  },
  {
    id: "ent-3",
    name: "Plomberie Gardoise",
    town: "Uzès",
    postcode: "30700",
    contact_name: "Marc Reynaud",
  },
  {
    id: "ent-4",
    name: "Menuiseries du Sud",
    town: "Montpellier",
    postcode: "34000",
    contact_name: "Claire Fabre",
  },
  {
    id: "ent-5",
    name: "Ateliers Peinture Provence",
    town: "Avignon",
    postcode: "84000",
    contact_name: "Julien Roux",
  },
];

function mockList(): ContractorWire[] {
  return [...MOCK_CONTRACTORS];
}

// ---------------------------------------------------------------------------
// Live proxy
// ---------------------------------------------------------------------------

function buildAuthHeaders(): Record<string, string> | null {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.OUVRO_API_KEY;
  if (!apiKey) {
    return null;
  }
  headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

export type ContractorsRouterDeps = {
  listLive?: (
    archidocApiUrl: string,
  ) => Promise<
    { data: { contractors: ContractorWire[] } } | { error: string; status: number }
  >;
  validateArchidocUrl?: (
    req: Request,
    res: ExpressResponse,
    next: NextFunction,
  ) => void;
};

async function defaultListLive(
  archidocApiUrl: string,
): Promise<
  { data: { contractors: ContractorWire[] } } | { error: string; status: number }
> {
  const headers = buildAuthHeaders();
  if (!headers) {
    return {
      error:
        "Server misconfigured: OUVRO_API_KEY is not set — refusing to forward unauthenticated request to ARCHIDOC",
      status: 500,
    };
  }
  const response = await archidocFetch(
    `${archidocApiUrl}/api/ouvro/contractors`,
    { method: "GET", headers, timeout: CONTRACTORS_TIMEOUT_MS },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[Contractors] ARCHIDOC list error (${response.status}):`, text);
    return { error: "Failed to load contractors", status: response.status };
  }
  const data = (await response.json()) as
    | { contractors?: ContractorWire[] }
    | ContractorWire[];
  const contractors = Array.isArray(data) ? data : data.contractors ?? [];
  return { data: { contractors } };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createContractorsRouter(
  deps: ContractorsRouterDeps = {},
): Router {
  const effectiveValidate = deps.validateArchidocUrl ?? requireArchidocUrl;
  const effectiveList = deps.listLive ?? defaultListLive;

  const router = Router();
  const guardUnlessMock = (
    req: Request,
    res: ExpressResponse,
    next: NextFunction,
  ) => {
    if (getMode() === "mock") return next();
    return effectiveValidate(req, res, next);
  };

  router.get(
    "/contractors",
    guardUnlessMock,
    async (_req: Request, res: ExpressResponse) => {
      try {
        const mode = getMode();
        if (mode === "mock") {
          return res.status(200).json({ contractors: mockList() });
        }
        const archidocApiUrl: string = res.locals.archidocApiUrl;
        const result = await effectiveList(archidocApiUrl);
        if ("error" in result) {
          if (mode === "auto" && result.status === 404) {
            // ARCHIDOC hasn't deployed /api/ouvro/contractors yet — serve the
            // seeded list so the field UI keeps working. Logged loudly so the
            // gap stays visible; flips to live data automatically once the
            // route exists.
            console.warn(
              "[Contractors] ARCHIDOC route missing (404) — serving seeded fallback list (mode=auto)",
            );
            return res.status(200).json({ contractors: mockList() });
          }
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(200).json(result.data);
      } catch (error: unknown) {
        const { status, message } = formatServerError(error, "Contractors List");
        return res.status(status).json({ error: message });
      }
    },
  );

  return router;
}

export const contractorsRouter = createContractorsRouter();
