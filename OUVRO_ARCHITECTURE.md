# OUVRO Architecture & Engineering Standards

> **Purpose:** This document codifies the architectural patterns established during the 5-phase surgical refactoring of the Ouvro mobile companion app. These rules exist to prevent architectural drift, eliminate duplication, and maintain a clean, maintainable codebase.

---

## 1. Device & Hardware Abstraction

### Rule

Never interact with Expo hardware APIs (`expo-camera`, `expo-audio`, `expo-file-system`, etc.) directly inside UI screen components.

### Standard

Encapsulate all hardware interactions in pure, custom React Hooks that expose a clean imperative API to the consuming screen.

**Established hooks:**

- `useAudioRecorder` — wraps `expo-audio` recording lifecycle (start, stop, pause, resume, metering)
- `useAudioPlayer` — wraps `expo-audio` playback lifecycle (load, play, pause, seek, position tracking, cleanup)

**Pattern:**

```typescript
// CORRECT — Screen consumes a hook
function AudioCaptureScreen() {
  const recorder = useAudioRecorder();
  // Screen only deals with UI and calls recorder.start(), recorder.stop(), etc.
}

// WRONG — Screen directly imports and manages Audio.Recording
function AudioCaptureScreen() {
  const recording = useRef<Audio.Recording>();
  await Audio.setAudioModeAsync({ ... }); // Hardware logic leaked into UI
}
```

### Exception: The "Premature Abstraction" Rule

If two screens share a hardware API but diverge significantly in their UI flow, business logic, or permission requirements (e.g., PhotoCaptureScreen vs. VideoCaptureScreen vs. AnnotationScreen), it is better to leave them as separate, self-contained screens than to create a complex "God Hook" with dozens of configuration flags. Shared hooks should only be extracted when the abstraction is clean and the screens genuinely share identical logic.

---

## 2. The API Client & Type Separation (Frontend)

### Rule

Runtime fetch logic and TypeScript type definitions must never live in the same file.

### Standard: File Organization

| File                           | Contents                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/lib/archidoc-types.ts` | All TypeScript interfaces, type aliases, and runtime constants (`FILE_CATEGORIES`, `ANNOTATION_COLORS`)                                                    |
| `client/lib/archidoc-api.ts`   | All fetch functions, mapper functions, and the `archidocApiFetch` base wrapper. Re-exports everything from `archidoc-types.ts` for backward compatibility. |

### Standard: Centralized Fetch Wrapper

All Archidoc API calls must route through the `archidocApiFetch` base function, which handles:

- `ARCHIDOC_API_URL` guard (throws if unconfigured)
- URL construction from relative paths
- `credentials: "include"` by default
- Standardized error handling (401, 403, generic)
- Optional `allowNotFound` for endpoints that legitimately return 404

```typescript
// CORRECT
const data = await archidocApiFetch<ProjectResponse>("/projects", {
  method: "GET",
});

// WRONG — raw fetch bypasses URL guard and error handling
const resp = await fetch(`${ARCHIDOC_API_URL}/projects`, {
  credentials: "include",
});
```

**Exception:** `uploadFileToSignedUrl` uses raw `fetch()` because it hits external signed storage URLs, not the Archidoc API.

### Standard: Mapper Functions

Always use mapper functions to translate raw backend JSON (snake_case, inconsistent field names) into clean frontend DTOs before passing data to the UI layer.

**Established mappers:**

- `mapRawProject(raw)` — normalizes project fields + resolves external links
- `mapDQEItem(raw)` — normalizes DQE item fields with multi-variant resilience
- `resolveExternalLinks(source)` — extracts photos, 3D model, 3D tour, and Google Drive URLs

```typescript
// CORRECT
const projects = rawProjects.map(mapRawProject);

// WRONG — inline field mapping scattered across components
const name = raw.project_name || raw.projectName || raw.name;
```

---

## 3. Offline Sync & Persistence

### Rule

Never use raw `AsyncStorage` or `FileSystem.copyAsync` inside business logic, sync queues, or screen components.

### Standard

All local data persistence and offline queue management must delegate to the generic `DurableQueueStore<T>` class located in `client/lib/durable-queue-store.ts`.

`DurableQueueStore<T>` provides:

- **AsyncStorage persistence** with automatic serialization/deserialization
- **Durable file copying** (media files copied to app-local directories to survive cache eviction)
- **Event emitter integration** for reactive UI updates
- **Atomic state transitions** for queue items

**Established consumers:**

| Module                        | Store Key              | Purpose                                                                                                               |
| ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `client/lib/offline-sync.ts`  | `PENDING_OBSERVATIONS` | Observation capture queue with states: `pending → uploading_metadata → uploading_media → partial → complete / failed` |
| `client/lib/offline-tasks.ts` | `PENDING_TASKS`        | Voice-to-task queue with states: `pending → transcribing → review → accepted → uploading → complete / failed`         |

```typescript
// CORRECT — Compose DurableQueueStore
const store = new DurableQueueStore<Observation>({
  storageKey: "PENDING_OBSERVATIONS",
  mediaDir: "observations-media",
});

// WRONG — Direct AsyncStorage in sync logic
await AsyncStorage.setItem("my_queue", JSON.stringify(items));
await FileSystem.copyAsync({ from: uri, to: localPath });
```

---

## 4. Data Architecture: Direct-to-Archidoc + DurableQueueStore

### Rule

The local PostgreSQL database is **NOT** used for domain data (projects, observations, DQE items, files). It is strictly reserved for infrastructure/system tables (`users`).

### Standard: Direct Archidoc Fetching (Frontend)

All domain entities must be fetched directly from the Archidoc API using the established functions in `client/lib/archidoc-api.ts`. **Do not** route domain queries through a local BFF default fetcher.

| Entity            | Correct fetch function         | Query key shape                         |
| ----------------- | ------------------------------ | --------------------------------------- |
| Single project    | `fetchProjectById(projectId)`  | `["/api/projects", projectId]`          |
| Project file list | `fetchProjectFiles(projectId)` | `["/api/projects", projectId, "files"]` |
| DQE items         | `fetchDQEItems(projectId)`     | `["/api/dqe", projectId]`               |

```typescript
// CORRECT — Archidoc API directly, typed via archidoc-types.ts
const { data: project } = useQuery<MappedProject>({
  queryKey: ["/api/projects", projectId],
  queryFn: () => fetchProjectById(projectId),
});

// WRONG — BFF default fetcher hitting local PostgreSQL (these routes no longer exist)
const { data } = useQuery({ queryKey: ["/api/projects", projectId] });
```

### Standard: Offline Queue (All Platforms)

Observations, tasks, and any other field-captured data that must survive network outages are persisted exclusively via `DurableQueueStore<T>`. See Section 3 for the full offline persistence standard.

```typescript
// CORRECT — read observations from DurableQueueStore, not local DB
const all = await offlineSyncService.getObservations();
const forProject = all.filter((o) => o.projectId === projectId);

// WRONG — query a local /api/observations endpoint (this route has been deleted)
const { data } = useQuery({ queryKey: ["/api/observations"] });
```

### Standard: Local PostgreSQL Scope

| Table   | Owner              | Purpose                                               |
| ------- | ------------------ | ----------------------------------------------------- |
| `users` | `shared/schema.ts` | Infrastructure — reserved for future auth integration |

**All other formerly local tables (`projects`, `observations`, `observation_media`, `project_files`) have been permanently dropped.** Do not re-create them.

---

## 5. The BFF Proxy Layer (Backend `server/routes/`)

### Rule

Never add new API routes to a monolithic `server/routes.ts` file.

### Standard: Thin Orchestrator

The main `server/routes.ts` file must remain a thin orchestrator (~30 lines) that mounts domain routers. It must not contain any route handler logic.

```typescript
// server/routes.ts — orchestrator pattern (current active routers)
app.use("/api/ai", aiRouter);
app.use("/api/archidoc", archidocRouter);
app.use("/api", syncRouter);
app.use("/api/dqe", dqeRouter);
```

### Standard: Domain Routers

All new endpoints must be placed in their respective domain router under `server/routes/`:

| Router File   | Prefix          | Responsibility                                                                         |
| ------------- | --------------- | -------------------------------------------------------------------------------------- |
| `ai.ts`       | `/api/ai`       | Gemini transcription & translation                                                     |
| `archidoc.ts` | `/api/archidoc` | Archidoc file proxy (upload URLs, archive, download)                                   |
| `sync.ts`     | `/api`          | Sync endpoints (observation sync, task sync)                                           |
| `dqe.ts`      | `/api/dqe`      | DQE video intake: download URL resolution → Gemini transcription → Archidoc submission |

> **Deleted routers (do not recreate):** `projects.ts` and `observations.ts` have been permanently removed. Those concerns are now handled directly by the frontend via `archidoc-api.ts` and `DurableQueueStore`.

### Standard: Archidoc Proxy Helpers

All proxy requests to the upstream Archidoc server must use the shared utilities in `server/routes/archidoc-helpers.ts`:

- **`requireArchidocUrl`** — Express middleware that returns 503 if `ARCHIDOC_API_URL` is not configured
- **`archidocJsonPost(path, body)`** — standardized POST with timeout, JSON headers, and error extraction
- **`buildArchidocObservationPayload(obs)`** — maps local observation schema to Archidoc API format

```typescript
// CORRECT
router.post("/upload", requireArchidocUrl, async (req, res) => {
  const result = await archidocJsonPost("/files/upload", req.body);
  res.json(result);
});

// WRONG — inline fetch with no timeout or error handling
router.post("/upload", async (req, res) => {
  const resp = await fetch(`${process.env.ARCHIDOC_API_URL}/files/upload`, { ... });
});
```

---

## 6. Screen Component Standards

### Header Components

- Standard navigation screens must use `OuvroScreenHeader` for consistent branding and layout.
- Full-screen media capture screens (camera, video, annotation) use purpose-built overlaid controls and are exempt from `OuvroScreenHeader`.

### Navigation

- All screen params are typed in `RootStackParamList` (`client/navigation/RootStackNavigator.tsx`).
- Media capture screens receive `projectId` and `projectName` via route params and pass media URIs downstream to `ObservationDetails`.

---

## 7. AI Agent Instructions

> **Mandatory reading.** Before proposing any code changes, new screens, or new API routes, you **MUST** read this file in its entirety.

### You are strictly forbidden from:

1. **Duplicating network calls** — All Archidoc API requests go through `archidocApiFetch`. All server-side proxy requests go through `archidocJsonPost`. No exceptions.

2. **Raw storage calls** — Never use `AsyncStorage.getItem/setItem` or `FileSystem.copyAsync` directly in business logic. Use `DurableQueueStore<T>`.

3. **Hardware API leaks** — Never import `expo-audio`, `expo-camera`, or similar hardware SDKs directly in screen components. Create or extend a custom hook.

4. **Monolithic route handlers** — Never add route logic to `server/routes.ts`. Create or extend a domain router under `server/routes/`.

5. **Inline field mapping** — Never manually map `snake_case` API fields in components. Create or extend a mapper function in `archidoc-api.ts`.

6. **Mixing types and runtime code** — Never add TypeScript interfaces to `archidoc-api.ts`. Types belong in `archidoc-types.ts`.

7. **Querying local PostgreSQL for domain data** — Never add `useQuery` calls that fetch projects, observations, files, or DQE items from a local BFF route. Those routes have been permanently deleted. Use `fetchProjectById()`, `fetchProjectFiles()`, `fetchDQEItems()` from `archidoc-api.ts` (frontend) or `offlineSyncService` for queue data. The only active local DB table is `users`.

### Before writing code, verify:

- [ ] Does a hook already exist for this hardware interaction?
- [ ] Does a mapper already exist for this API response shape?
- [ ] Does a domain router already exist for this endpoint category?
- [ ] Am I using `DurableQueueStore` for any offline persistence?
- [ ] Am I using `archidocApiFetch` (frontend) or `archidocJsonPost` (backend) for API calls?
- [ ] Am I fetching domain entities (`projects`, `files`, `dqe`) via the correct `archidoc-api.ts` functions and **not** from a local BFF route?

### When adding new features:

1. Define types in `archidoc-types.ts`
2. Add fetch/mapper logic in `archidoc-api.ts`
3. Add server routes in the appropriate domain router under `server/routes/`
4. Use `DurableQueueStore<T>` for any offline queue
5. Create a custom hook for any new hardware interaction
6. Update `replit.md` with architectural changes

---

## 8. Strict Type Integrity & Anti-Slop Mandate

> **Visibility:** This rule applies to every file, every session, every agent. It is not optional.
> Violations here are treated identically to runtime bugs — they must be corrected before any PR or commit is considered complete.

### Rule

The TypeScript compiler is a correctness gate, not a linter suggestion. `tsconfig.json` has `"strict": true` permanently enabled. No future change may weaken or circumvent this setting.

---

### The `any` Keyword is Strictly Banned

You are **strictly prohibited** from introducing `: any`, `as any`, or `<any>` anywhere in this codebase — in production code, test files, or type declarations.

**Banned:**
```typescript
// ALL of these are forbidden
function foo(x: any) { ... }
const result = response as any;
const items = data as Array<any>;
catch (e: any) { ... }
```

**Required alternatives:**
```typescript
// Use unknown at boundaries, then narrow
function foo(x: unknown) { ... }
const result = response as SpecificType;       // only when the shape is known
const items = data as Array<SpecificItem>;     // only when the shape is known
catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); }
```

---

### Strict API Boundaries

All data arriving from the Archidoc API or the BFF proxy **must** be immediately assigned to a typed interface before use.

- Raw API response shapes → `client/lib/archidoc-types.ts` (e.g., `RawProject`, `RawDQEItem`, `RawExternalLinks`)
- Mapped/domain shapes → `client/lib/archidoc-types.ts` or `client/lib/archidoc-api.ts`
- BFF envelope → `ArchidocHttpResult<T>` from `server/routes/archidoc-helpers.ts`

**Banned:**
```typescript
async function mapRawProject(raw: any) { ... }   // raw JSON as any
const data: any = await response.json();          // untyped JSON
```

**Required:**
```typescript
async function mapRawProject(raw: RawProject) { ... }
const data: SpecificResponseType = await response.json();
```

---

### Safe Error Handling

Every `catch` block in the codebase uses `unknown`. This is non-negotiable.

**Banned:**
```typescript
catch (e: any) {
  doSomething(e.message);    // compiler blind spot
}
```

**Required:**
```typescript
catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  doSomething(message);
}
```

---

### Strict Component & Event Contracts

**React component props** must be fully typed. No prop may be typed as `any`.

```typescript
// Banned
type Props = { source: any; onError?: (error?: any) => void };

// Required
type Props = { source: ImageSourcePropType; onError?: (error?: unknown) => void };
```

**Event emitter payloads** in `DurableQueueStore` and all derived services (`offline-sync`, `offline-tasks`, `offline-annotations`, `offline-dqe`) must use `unknown` or a discriminated union — never `data?: any`.

```typescript
// Banned
type EventListener = (event: string, data?: any) => void;

// Required
type EventListener = (event: string, data?: unknown) => void;
```

When accessing a known payload after emission, narrow with a typed const:
```typescript
case "progressUpdated": {
  const progress = data as SyncProgress;   // explicit, auditable cast
  setSyncProgress(progress);
  break;
}
```

---

### Shared UI Types

Icon name types and other UI-specific string unions that must be passed as component props must be defined in `client/lib/types.ts` and imported where needed. Do not use `as any` to satisfy icon or enum prop types.

```typescript
// client/lib/types.ts
export type FeatherIconName = ComponentProps<typeof Feather>["name"];

// Usage
function getFileIcon(contentType: string): FeatherIconName { ... }
<Feather name={getFileIcon(item.contentType)} />   // no cast needed
```

---

### Compliance Checklist (run before every commit)

- [ ] `npx tsc --noEmit` exits with code 0 and zero errors
- [ ] `grep -rn ": any\b\|as any\b\|<any>" client/ server/` returns **zero matches**
- [ ] Every `catch` block uses `catch (e: unknown)` with an explicit type-guard before `.message` access
- [ ] Every new API mapper function declares a typed `Raw*` interface in `archidoc-types.ts`
- [ ] No new component prop is typed as `any`

---

### Staging Validation Log

| Date (UTC) | Event | Outcome |
|---|---|---|
| 2026-04-21 | Task #16 — first end-to-end snag smoke against Archidoc staging (`https://archidoc-app-ARCHIDOC.replit.app`) | **BLOCKED** — `POST /api/ouvro/snags` returns Express default `404 Cannot POST /api/ouvro/snags` (HTML body), confirming the snag intake route is not mounted on staging. Verified with the rotated `OUVRO_API_KEY` (a wrong bearer would surface 401, not the route-missing 404) and the real staging project ID `7e2ea927-9f2b-4322-a5ba-bea612b747cf` for `MASSEY (RUSSAN) 1339` (sanity-check `GET /api/ouvro/projects/{id}` returned 200 for the same bearer). The dev project ID `714f755d-…` shared earlier does **not** exist on staging — staging carries its own project list reachable via `GET /api/ouvro/projects`. Only `GET /api/ouvro/projects[/{id}]` and `POST /api/uploads/request-url` are currently reachable on staging. Smoke runner (`smoke-snags.ts`) and run log (`.local/smoke-logs/run-2026-04-21T05-23-34-958Z.json`) retained for replay once Archidoc deploys the intake route. Findings handoff in `.local/smoke-logs/findings-2026-04-21.md`. |
| 2026-04-21 | Task #17 — re-run smoke after Archidoc redeploy | **PARTIAL → GREEN.** First post-redeploy run: 4/8 PASS. Two real findings: (a) `media[i].fileName` is required by Archidoc's Zod schema but was not in our `SnagMediaItem` type or BFF validator — fixed by adding required `fileName: string` to `SnagMediaItem` (`client/lib/archidoc-types.ts`), `SnagMediaInput` (`server/routes/snags.ts`), the `validateMediaItem` guard, the `submitMedia` mapper in `client/lib/offline-snags.ts`, and the unit-test fixture in `server/routes/__tests__/snags.test.ts`; `PendingSnagMedia.fileName` already existed and flows through. (b) Staging now accepts whitespace-only titles (contradicts the original contract note that they would 400). S6 was repurposed to send `description: { not: "a string" }`, which our BFF forwards untouched and Archidoc rejects with `VALIDATION_FAILED` — a cleaner exercise of the upstream-error passthrough path. **Final run: 8/8 PASS** (S8 skipped per the agreed coordinated-window plan). Real Archidoc deepLinks confirmed: `…/pv-reception?tab=defauts&item=17` (S1), `…?tab=reserves&item=19` (S3); replay returned `duplicate: true`; bad bearer returned `401 Unauthorized` direct from staging; bad projectId returned `400 PROJECT_NOT_FOUND` via BFF passthrough. Run log: `.local/smoke-logs/run-2026-04-21T05-46-21-105Z.json`. Unit tests: 12/12. Outstanding: S8 disabled-mode window (Task #19) and mobile-side blank-title guard now that staging is permissive (Task #20). |
