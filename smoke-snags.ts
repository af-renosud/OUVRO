/**
 * One-shot end-to-end smoke runner for the Ouvro snag intake.
 *
 * Walks through Archidoc's pre-agreed 8 scenarios (#8 is coordinated and
 * skipped by default — pass `--include-disabled` only during the agreed
 * Archidoc disabled-mode window). Exits non-zero on any miss.
 *
 *   tsx smoke-snags.ts
 *
 * Required env:
 *   - ARCHIDOC_API_URL        Archidoc staging base URL
 *   - OUVRO_API_KEY           bearer key the BFF uses to call Archidoc
 *   - OUVRO_TEST_PROJECT_ID   seeded staging project (e.g. MASSEY (RUSSAN) 1339)
 *
 * Optional env:
 *   - SMOKE_BFF_URL           defaults to http://localhost:5000
 *   - SMOKE_CLIENT_VERSION    defaults to "smoke-1.0.0"
 *   - SMOKE_LOG_DIR           defaults to .local/smoke-logs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  SnagSubmitParams,
  SnagSubmitResponse,
  UploadUrlResponse,
} from "./client/lib/archidoc-types.ts";

const STAGING_URL = required("ARCHIDOC_API_URL");
const API_KEY = required("OUVRO_API_KEY");
const PROJECT_ID = required("OUVRO_TEST_PROJECT_ID");
const BFF_URL = process.env.SMOKE_BFF_URL || "http://localhost:5000";
const CLIENT_VERSION = process.env.SMOKE_CLIENT_VERSION || "smoke-1.0.0";
const LOG_DIR = process.env.SMOKE_LOG_DIR || ".local/smoke-logs";
const INCLUDE_DISABLED = process.argv.includes("--include-disabled");

const BAD_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`[smoke] missing required env var: ${name}`);
    process.exit(2);
  }
  return v;
}

type ScenarioResult = {
  id: string;
  name: string;
  pass: boolean;
  notes: string[];
  status?: number;
  body?: unknown;
  error?: string;
};

const results: ScenarioResult[] = [];

function record(r: ScenarioResult): void {
  results.push(r);
  const tag = r.pass ? "PASS" : "FAIL";
  console.log(`\n[${tag}] ${r.id} — ${r.name} (status=${r.status ?? "n/a"})`);
  for (const n of r.notes) console.log(`    · ${n}`);
  if (r.error) console.log(`    ! ${r.error}`);
}

function newLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function postBffSnag(
  body: Partial<SnagSubmitParams>,
): Promise<{ status: number; data: SnagSubmitResponse & Record<string, unknown> }> {
  const res = await fetch(`${BFF_URL}/api/snags/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OUVRO-Client-Version": CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as SnagSubmitResponse &
    Record<string, unknown>;
  return { status: res.status, data };
}

async function postStagingDirect(
  bearer: string,
  body: Record<string, unknown>,
): Promise<{ status: number; bodyText: string; json: Record<string, unknown> }> {
  const res = await fetch(`${STAGING_URL}/api/ouvro/snags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "X-OUVRO-Client-Version": CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* leave empty */
  }
  return { status: res.status, bodyText: text, json };
}

async function requestUploadUrl(): Promise<UploadUrlResponse> {
  const fileName = `smoke-${Date.now()}.jpg`;
  const res = await fetch(`${STAGING_URL}/api/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: fileName,
      contentType: "image/jpeg",
      size: 1024,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`upload-url failed (${res.status}): ${t}`);
  }
  return (await res.json()) as UploadUrlResponse;
}

async function warmUp(): Promise<void> {
  console.log("[smoke] warm-up: probing staging /api/uploads/request-url …");
  const upload = await requestUploadUrl();
  if (!upload.objectPath) {
    throw new Error("warm-up: staging returned no objectPath");
  }
  console.log(`[smoke] warm-up OK — sample objectPath: ${upload.objectPath}`);
}

function buildBaseSnagBody(
  overrides: Partial<SnagSubmitParams> = {},
): SnagSubmitParams {
  return {
    localId: newLocalId("smoke"),
    projectId: PROJECT_ID,
    projectName: "MASSEY (RUSSAN) 1339",
    type: "defaut",
    title: "Smoke — fissure mur porteur",
    description: "Smoke test from Ouvro BFF",
    severity: "major",
    capturedAt: nowIso(),
    capturedBy: "smoke-runner",
    media: [],
    ...overrides,
  };
}

// ── Scenarios ────────────────────────────────────────────────────────────────

async function scenario1NewDefautWithMedia(): Promise<string> {
  const upload = await requestUploadUrl();
  const localId = newLocalId("smoke-1-defaut");
  const body = buildBaseSnagBody({
    localId,
    media: [
      {
        type: "photo",
        objectPath: upload.objectPath,
        fileName: `smoke-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      },
    ],
  });

  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 200) {
    pass = false;
    notes.push(`expected BFF status 200 (wraps Archidoc 201), got ${status}`);
  }
  if (data.success !== true) {
    pass = false;
    notes.push(`expected success: true, got ${String(data.success)}`);
  }
  if (!data.archidocSnagId) {
    pass = false;
    notes.push("missing archidocSnagId");
  }
  if (!data.deepLink) {
    pass = false;
    notes.push("missing deepLink");
  } else if (!data.deepLink.includes("tab=defauts")) {
    pass = false;
    notes.push(`deepLink should contain tab=defauts: ${data.deepLink}`);
  }
  if (data.duplicate === true) {
    pass = false;
    notes.push("first submit must not be flagged duplicate: true");
  }

  notes.push(`archidocSnagId=${data.archidocSnagId}`);
  notes.push(`deepLink=${data.deepLink}`);

  record({
    id: "S1",
    name: "New snag, type=defaut, 1 media → success + tab=defauts",
    pass,
    notes,
    status,
    body: data,
  });
  return localId;
}

async function scenario2ReplaySameLocalId(localId: string): Promise<void> {
  const upload = await requestUploadUrl();
  const body = buildBaseSnagBody({
    localId,
    media: [
      {
        type: "photo",
        objectPath: upload.objectPath,
        fileName: `smoke-replay-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      },
    ],
  });
  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 200) {
    pass = false;
    notes.push(`expected 200, got ${status}`);
  }
  if (data.duplicate !== true) {
    pass = false;
    notes.push(`expected duplicate: true on replay, got ${String(data.duplicate)}`);
  }
  if (!data.archidocSnagId) {
    pass = false;
    notes.push("missing archidocSnagId on replay");
  }
  notes.push(`archidocSnagId=${data.archidocSnagId} duplicate=${String(data.duplicate)}`);

  record({
    id: "S2",
    name: "Replay same localId → duplicate: true",
    pass,
    notes,
    status,
    body: data,
  });
}

async function scenario3Reserve(): Promise<void> {
  const upload = await requestUploadUrl();
  const body = buildBaseSnagBody({
    localId: newLocalId("smoke-3-reserve"),
    type: "reserve",
    title: "Smoke — réserve sur peinture",
    media: [
      {
        type: "photo",
        objectPath: upload.objectPath,
        fileName: `smoke-reserve-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      },
    ],
  });
  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 200) {
    pass = false;
    notes.push(`expected 200, got ${status}`);
  }
  if (data.success !== true) {
    pass = false;
    notes.push(`expected success: true, got ${String(data.success)}`);
  }
  if (!data.deepLink || !data.deepLink.includes("tab=reserves")) {
    pass = false;
    notes.push(`deepLink should contain tab=reserves: ${data.deepLink}`);
  }
  notes.push(`archidocSnagId=${data.archidocSnagId}`);
  notes.push(`deepLink=${data.deepLink}`);

  record({
    id: "S3",
    name: "type=reserve → success + tab=reserves",
    pass,
    notes,
    status,
    body: data,
  });
}

async function scenario4EmptyMedia(): Promise<void> {
  const body = buildBaseSnagBody({
    localId: newLocalId("smoke-4-nomedia"),
    media: [],
  });
  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 200) {
    pass = false;
    notes.push(`expected 200 (contract allows media: []), got ${status}`);
  }
  if (data.success !== true) {
    pass = false;
    notes.push(`expected success: true, got ${String(data.success)}`);
  }
  if (!data.archidocSnagId) {
    pass = false;
    notes.push("missing archidocSnagId");
  }
  notes.push(`archidocSnagId=${data.archidocSnagId}`);

  record({
    id: "S4",
    name: "media: [] → accepted",
    pass,
    notes,
    status,
    body: data,
  });
}

async function scenario5BadProjectId(): Promise<void> {
  const body = buildBaseSnagBody({
    localId: newLocalId("smoke-5-badproj"),
    projectId: BAD_PROJECT_ID,
    media: [],
  });
  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 400) {
    pass = false;
    notes.push(`expected 400, got ${status}`);
  }
  if (data.code !== "PROJECT_NOT_FOUND") {
    pass = false;
    notes.push(`expected code: PROJECT_NOT_FOUND, got ${data.code}`);
  }
  if (data.success === true) {
    pass = false;
    notes.push("expected success: false");
  }
  notes.push(`error=${data.error}`);

  record({
    id: "S5",
    name: "Bad projectId → 400 PROJECT_NOT_FOUND",
    pass,
    notes,
    status,
    body: data,
  });
}

async function scenario6UpstreamValidationPassthrough(): Promise<void> {
  // S6 originally exercised whitespace-only title → 400 VALIDATION_FAILED, but
  // staging (as redeployed 2026-04-21) accepts whitespace titles and persists
  // them. To still exercise our BFF's pass-through of upstream Zod errors, we
  // submit `description` as an object: our BFF treats it as truthy and forwards
  // it untouched, and Archidoc's schema rejects with VALIDATION_FAILED.
  const base = buildBaseSnagBody({
    localId: newLocalId("smoke-6-baddesc"),
    media: [],
  });
  const body: Record<string, unknown> = { ...base, description: { not: "a string" } };
  const res = await fetch(`${BFF_URL}/api/snags/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OUVRO-Client-Version": CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as SnagSubmitResponse &
    Record<string, unknown>;
  const status = res.status;
  const notes: string[] = [];
  let pass = true;

  if (status !== 400) {
    pass = false;
    notes.push(`expected 400, got ${status}`);
  }
  if (data.code !== "VALIDATION_FAILED") {
    pass = false;
    notes.push(`expected code: VALIDATION_FAILED, got ${data.code}`);
  }
  notes.push(`error=${data.error}`);

  record({
    id: "S6",
    name: "Upstream VALIDATION_FAILED passthrough (description: object)",
    pass,
    notes,
    status,
    body: data,
  });
}

async function scenario7BadBearer(): Promise<void> {
  // Hits Archidoc directly because our BFF uses the env var bearer; the only
  // way to exercise upstream auth is to bypass the BFF.
  const localId = newLocalId("smoke-7-badbearer");
  const body = {
    localId,
    projectId: PROJECT_ID,
    projectName: "MASSEY (RUSSAN) 1339",
    type: "defaut",
    title: "Smoke — bad bearer",
    capturedAt: nowIso(),
    capturedBy: "smoke-runner",
    media: [],
  };
  const { status, json, bodyText } = await postStagingDirect(
    "obviously-not-a-real-key-aaaaaaaaaaaaaaaa",
    body,
  );
  const notes: string[] = [];
  let pass = true;

  if (status !== 401) {
    pass = false;
    notes.push(`expected 401, got ${status}`);
  }
  if (typeof json.error !== "string" || !/unauthor/i.test(json.error)) {
    pass = false;
    notes.push(`expected body.error matching /unauthor/i, got ${bodyText.slice(0, 200)}`);
  }
  notes.push(`bodySnippet=${bodyText.slice(0, 120)}`);

  record({
    id: "S7",
    name: "Bad bearer → 401 Unauthorized (direct staging)",
    pass,
    notes,
    status,
    body: json,
  });
}

async function scenario8FeatureDisabled(): Promise<void> {
  // Coordinated 5-min disabled window with Archidoc on Slack.
  // Skipped unless --include-disabled passed AND the window is open.
  if (!INCLUDE_DISABLED) {
    record({
      id: "S8",
      name: "OUVRO_SNAGS_ENABLED=false → 503 FEATURE_DISABLED",
      pass: true,
      notes: [
        "skipped — coordinated disabled-mode window required",
        "re-run with --include-disabled when Archidoc DMs 'snags disabled, go'",
      ],
    });
    return;
  }
  const body = buildBaseSnagBody({
    localId: newLocalId("smoke-8-disabled"),
    media: [],
  });
  const { status, data } = await postBffSnag(body);
  const notes: string[] = [];
  let pass = true;

  if (status !== 503) {
    pass = false;
    notes.push(`expected 503, got ${status}`);
  }
  if (data.code !== "FEATURE_DISABLED") {
    pass = false;
    notes.push(`expected code: FEATURE_DISABLED, got ${data.code}`);
  }
  notes.push(`error=${data.error}`);

  record({
    id: "S8",
    name: "OUVRO_SNAGS_ENABLED=false → 503 FEATURE_DISABLED",
    pass,
    notes,
    status,
    body: data,
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("Ouvro snag smoke — Archidoc staging");
  console.log("=".repeat(70));
  console.log(`BFF:        ${BFF_URL}`);
  console.log(`Staging:    ${STAGING_URL}`);
  console.log(`Project:    ${PROJECT_ID}`);
  console.log(`ClientVer:  ${CLIENT_VERSION}`);
  console.log(`Disabled?:  ${INCLUDE_DISABLED ? "yes (window open)" : "no (skipped)"}`);

  try {
    await warmUp();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[smoke] warm-up FAILED: ${msg}`);
    record({
      id: "WARMUP",
      name: "Connectivity warm-up",
      pass: false,
      notes: [],
      error: msg,
    });
    await persistAndExit();
    return;
  }

  const scenarios: Array<{ name: string; fn: () => Promise<void> }> = [];
  let s1LocalId: string | null = null;

  scenarios.push({
    name: "S1 → S2 (defaut + replay)",
    fn: async () => {
      s1LocalId = await scenario1NewDefautWithMedia();
      if (s1LocalId) await scenario2ReplaySameLocalId(s1LocalId);
    },
  });
  scenarios.push({ name: "S3 reserve", fn: scenario3Reserve });
  scenarios.push({ name: "S4 empty media", fn: scenario4EmptyMedia });
  scenarios.push({ name: "S5 bad projectId", fn: scenario5BadProjectId });
  scenarios.push({ name: "S6 upstream VALIDATION_FAILED passthrough", fn: scenario6UpstreamValidationPassthrough });
  scenarios.push({ name: "S7 bad bearer", fn: scenario7BadBearer });
  scenarios.push({ name: "S8 feature disabled", fn: scenario8FeatureDisabled });

  for (const s of scenarios) {
    try {
      await s.fn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[smoke] ${s.name} threw: ${msg}`);
      record({
        id: s.name,
        name: s.name,
        pass: false,
        notes: [],
        error: msg,
      });
    }
  }

  await persistAndExit();
}

async function persistAndExit(): Promise<void> {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`SUMMARY: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}`);
  console.log("=".repeat(70));
  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.id} — ${r.name}`);
  }

  await mkdir(LOG_DIR, { recursive: true }).catch(() => {});
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(LOG_DIR, `run-${stamp}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        bff: BFF_URL,
        staging: STAGING_URL,
        projectId: PROJECT_ID,
        clientVersion: CLIENT_VERSION,
        includeDisabled: INCLUDE_DISABLED,
        passed,
        failed,
        results,
      },
      null,
      2,
    ),
  ).catch((e: unknown) => {
    console.error("[smoke] failed to write log:", e instanceof Error ? e.message : String(e));
  });
  console.log(`\nLog written to: ${logPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

void main();
