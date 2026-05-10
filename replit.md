# OUVRO — Mobile Companion App

On-site documentation companion for architects/PMs. Captures media,
annotations, voice tasks, and DQE videos in the field, syncs into the
ARCHIDOC construction-management platform when signal returns. Dual
brand: OUVRO + Architects-France.

## Stack
- **Mobile:** Expo SDK 54, React Native, React Navigation 7+, TanStack Query.
- **Backend:** Express + TypeScript, port 5000. Domain routers under
  `server/routes/` (projects, observations, ai, archidoc, sync, dqe);
  ARCHIDOC proxying via `server/routes/archidoc-helpers.ts`.
- **DB:** PostgreSQL on Neon, Drizzle ORM. Schema in `shared/schema.ts`.
- **AI:** Gemini (audio → English transcription, EN → FR translation).
- **Distribution:** Expo Go (no standalone build).

## Run / Build
- Dev: workflow `Start App` → `npm run server:dev && npm run expo:dev`
  (Express :5000, Expo :8081).
- Static Expo build for deploy: `npm run expo:static:build`. Must run in
  the deployment env or with `EXPO_PUBLIC_DOMAIN=<prod-host>` set —
  otherwise the build's manifest hygiene guard refuses to write.
- Tests: `npx tsx --test server/__tests__/cache-headers.test.ts`.

## User Preferences
- Simple language, iterative changes, ask before major rewrites,
  detailed explanations preferred.

## Forbidden / careful
- **Never edit `package.json` or anything under `scripts/`** (stack rule).
- Never hard-code a domain on the client — use `getApiUrl()` /
  `process.env.EXPO_PUBLIC_DOMAIN`.
- Never re-introduce `no-cache` headers on `/`, `/manifest`, or
  `manifest.json` (see Expo Go Persistence below).
- Bundle identifiers in `app.json` are frozen unless the user asks.

## Key Files
- `client/App.tsx` — root, wraps `ErrorBoundary` + `ColdStartOverlay`.
- `client/lib/durable-queue-store.ts` — generic offline queue used by
  `offline-sync.ts` (observations), `offline-tasks.ts`, `offline-dqe.ts`,
  `offline-annotations.ts`.
- `client/hooks/useProjectLock.tsx` — sticky project selection.
- `client/lib/audit-prompts.ts` — pre-deployment audit prompt text.
- `server/cache-headers.ts` — single source of truth for Expo cache
  headers (used by `server/index.ts` and the cache test).
- `server/__tests__/cache-headers.test.ts` — guards the persistence
  cache contract.
- `shared/task-sync-types.ts` — `TaskSyncPayload` contract (see JSDoc
  there for the wire-level rules).
- `scripts/build.js` — static build, manifest URL rewriter, hygiene guard.

## Features (current state)
- **Capture FAB → CaptureModal** with Photo, Video, DQE, Audio, Action.
- **Observation sync:** local-first, dequeues only on Archidoc 200 OK.
  States: pending → uploading_metadata → uploading_media → partial →
  complete / failed.
- **Task capture (audio-first, offline-first):** "Accept & Save" stores
  audio + `localId` UUID immediately; optional "Transcribe First"
  invokes Gemini before review. Sync via `POST /api/tasks/sync`
  (`TaskSyncPayload`); server auto-transcribes if only audio is
  supplied. Auto-sync on NetInfo reconnect + interval retry. States:
  pending → transcribing → review → accepted → uploading →
  complete / failed. Priority: low/normal/high/urgent. Class:
  defect/action/followup/general.
- **Annotation system:** pen, arrow, circle, rectangle, freehand, text,
  measurement; pinch-to-zoom; flattened to image. Local save first,
  background upload, queued items visible in Queue screen.
- **DQE Field Video Capture:** offline-first narrated video workflow,
  three quality tiers (iPad gets the highest), lens + torch toggles,
  auto stabilisation, landscape-adaptive review. Two-step sync:
  presigned PUT → `POST /api/dqe/submit` → Archidoc
  `/api/ouvro/dqe/capture`. Auth: `x-api-key: $OUVRO_API_KEY`.
- **Project Lock:** sticky project selection, persists in AsyncStorage,
  surfaces on cards, Settings, and CaptureModal.
- **Project Asset Hub:** 2×3 grid (PLANS, DQE, DOCS, LINKS, FICHES,
  DRIVE) with availability-driven enable state.
- **DQE Browser:** filter by lot code or contractor (`/api/contractors`).
- **PDF viewer:** `react-native-webview` + "Capture for Annotation" (iOS
  uses native screenshot detection).
- **Cold-start overlay (`client/components/ColdStartOverlay.tsx`):**
  branded "Loading from your device — no signal needed" splash on every
  cold launch, dismissed when `NavigationContainer.onReady` fires.

## Design Tokens
Colors, typography, spacing, shadows: `constants/theme.ts` (`Colors`
object). Touch targets ≥48pt, FAB 92pt. Use `boxShadow` on web, native
`shadow*` props on iOS/Android. Dual brand handled in
`client/components/HeaderTitle.tsx`.

## API Field Mapping
- Types: `archidoc-types.ts`. Runtime: `archidoc-api.ts`. All requests
  go through `archidocApiFetch` (URL building, auth, error checking).
- `mapRawProject`, `mapDQEItem` normalise snake_case → camelCase and
  tolerate field-name variants.

## Environment
- `OUVRO_API_KEY` — shared secret for `POST /api/ouvro/dqe/capture`.
  Must match Archidoc's value.
- `EXPO_PUBLIC_DOMAIN` — explicit deployment host override (highest
  precedence in `getDeploymentDomain()`).
- `REPLIT_INTERNAL_APP_DOMAIN` — set automatically in deploy env.
- DB connection + Gemini key via Replit secrets.
- ARCHIDOC base URL: `https://archidoc-app-archidoc.replit.app`.

## Expo Go Persistence (poor-signal field use)
Expo Go always revalidates the manifest on cold launch — there is no
`expo-updates fallbackToCacheTimeout`. We minimise the cold-start
network dependency:

- **Cache headers** (single source: `server/cache-headers.ts`).
  Manifest endpoints (`/` + `expo-platform` header, `/manifest`, and
  `static-build/*/manifest.json`): `Cache-Control: public, max-age=300,
  stale-while-revalidate=2592000` plus `Vary: expo-platform, Accept`.
  Landing page (`/` without `expo-platform`): same Cache-Control + Vary.
  Content-addressed bundles (`/<timestamp>/_expo/static/...`):
  `public, max-age=31536000, immutable`. Guarded by
  `server/__tests__/cache-headers.test.ts` — do not regress.
- **Service worker** (`server/templates/sw.js`, version `v2`). Three
  caches: `ouvro-shell`, `ouvro-manifest`, `ouvro-bundle`. Install pre-
  caches landing shell + iOS/Android manifest + their `launchAsset`
  bundles. Runtime: SWR for manifests, cache-first for bundles. Bump
  `CACHE_VERSION` on any SW change.
- **Build URL hygiene** (`scripts/build.js`). Rewrites any
  `127.0.0.1:*`, `localhost:*`, or `*.replit.dev` URL Metro bakes into
  `manifest.extra.expoClient` (incl. `iconUrl`, `*ImageUrl`) to the
  deployment host. `assertManifestIsProductionSafe` then fails the
  build if any forbidden host remains. `static-build/*/manifest.json`
  is a build artifact and is **not** committed.
- **Limitation.** Install-once persistence (zero manifest revalidation)
  needs a standalone EAS Build → TestFlight / signed APK. Out of scope
  while the team uses Expo Go.

## Pre-Deployment Audits
Settings screen exposes three copy-to-clipboard prompts
(`client/lib/audit-prompts.ts`):
1. **Database** — schema vs `shared/schema.ts`, FKs, cascades, orphans,
   indexes.
2. **Application** — every server route, env vars, timeouts, error
   shapes.
3. **Data Persistence** — offline state machines, AsyncStorage keys,
   durable media, reconnect retry, interrupted-upload recovery.

Agent shortcuts:
- **"update pre-deployment audits"** — re-read `shared/schema.ts`,
  `server/routes/*`, `client/lib/offline-*.ts`, regenerate the prompt
  text in `client/lib/audit-prompts.ts`.
- **"RUN REDEPLOYMENT AUDITS"** — execute all three audits in order
  (real SQL via `execute_sql`, real curl on :5000, real read of
  `client/lib/offline-sync.ts`) and produce a consolidated pass/fail
  report.
