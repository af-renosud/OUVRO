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

| File | Contents |
|---|---|
| `client/lib/archidoc-types.ts` | All TypeScript interfaces, type aliases, and runtime constants (`FILE_CATEGORIES`, `ANNOTATION_COLORS`) |
| `client/lib/archidoc-api.ts` | All fetch functions, mapper functions, and the `archidocApiFetch` base wrapper. Re-exports everything from `archidoc-types.ts` for backward compatibility. |

### Standard: Centralized Fetch Wrapper

All Archidoc API calls must route through the `archidocApiFetch` base function, which handles:

- `ARCHIDOC_API_URL` guard (throws if unconfigured)
- URL construction from relative paths
- `credentials: "include"` by default
- Standardized error handling (401, 403, generic)
- Optional `allowNotFound` for endpoints that legitimately return 404

```typescript
// CORRECT
const data = await archidocApiFetch<ProjectResponse>("/projects", { method: "GET" });

// WRONG — raw fetch bypasses URL guard and error handling
const resp = await fetch(`${ARCHIDOC_API_URL}/projects`, { credentials: "include" });
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

| Module | Store Key | Purpose |
|---|---|---|
| `client/lib/offline-sync.ts` | `PENDING_OBSERVATIONS` | Observation capture queue with states: `pending → uploading_metadata → uploading_media → partial → complete / failed` |
| `client/lib/offline-tasks.ts` | `PENDING_TASKS` | Voice-to-task queue with states: `pending → transcribing → review → accepted → uploading → complete / failed` |

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

## 4. The BFF Proxy Layer (Backend `server/routes/`)

### Rule

Never add new API routes to a monolithic `server/routes.ts` file.

### Standard: Thin Orchestrator

The main `server/routes.ts` file must remain a thin orchestrator (~30 lines) that mounts domain routers. It must not contain any route handler logic.

```typescript
// server/routes.ts — orchestrator pattern
app.use("/api/projects", projectsRouter);
app.use("/api/observations", observationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/archidoc", archidocRouter);
app.use("/api", syncRouter);
```

### Standard: Domain Routers

All new endpoints must be placed in their respective domain router under `server/routes/`:

| Router File | Prefix | Responsibility |
|---|---|---|
| `projects.ts` | `/api/projects` | Project CRUD, DQE, contractors |
| `observations.ts` | `/api/observations` | Observation CRUD |
| `ai.ts` | `/api/ai` | Gemini transcription & translation |
| `archidoc.ts` | `/api/archidoc` | Archidoc file proxy (upload URLs, archive, download) |
| `sync.ts` | `/api` | Sync endpoints (observation sync, task sync) |

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

## 5. Screen Component Standards

### Header Components

- Standard navigation screens must use `OuvroScreenHeader` for consistent branding and layout.
- Full-screen media capture screens (camera, video, annotation) use purpose-built overlaid controls and are exempt from `OuvroScreenHeader`.

### Navigation

- All screen params are typed in `RootStackParamList` (`client/navigation/RootStackNavigator.tsx`).
- Media capture screens receive `projectId` and `projectName` via route params and pass media URIs downstream to `ObservationDetails`.

---

## 6. AI Agent Instructions

> **Mandatory reading.** Before proposing any code changes, new screens, or new API routes, you **MUST** read this file in its entirety.

### You are strictly forbidden from:

1. **Duplicating network calls** — All Archidoc API requests go through `archidocApiFetch`. All server-side proxy requests go through `archidocJsonPost`. No exceptions.

2. **Raw storage calls** — Never use `AsyncStorage.getItem/setItem` or `FileSystem.copyAsync` directly in business logic. Use `DurableQueueStore<T>`.

3. **Hardware API leaks** — Never import `expo-audio`, `expo-camera`, or similar hardware SDKs directly in screen components. Create or extend a custom hook.

4. **Monolithic route handlers** — Never add route logic to `server/routes.ts`. Create or extend a domain router under `server/routes/`.

5. **Inline field mapping** — Never manually map `snake_case` API fields in components. Create or extend a mapper function in `archidoc-api.ts`.

6. **Mixing types and runtime code** — Never add TypeScript interfaces to `archidoc-api.ts`. Types belong in `archidoc-types.ts`.

### Before writing code, verify:

- [ ] Does a hook already exist for this hardware interaction?
- [ ] Does a mapper already exist for this API response shape?
- [ ] Does a domain router already exist for this endpoint category?
- [ ] Am I using `DurableQueueStore` for any offline persistence?
- [ ] Am I using `archidocApiFetch` (frontend) or `archidocJsonPost` (backend) for API calls?

### When adding new features:

1. Define types in `archidoc-types.ts`
2. Add fetch/mapper logic in `archidoc-api.ts`
3. Add server routes in the appropriate domain router under `server/routes/`
4. Use `DurableQueueStore<T>` for any offline queue
5. Create a custom hook for any new hardware interaction
6. Update `replit.md` with architectural changes
