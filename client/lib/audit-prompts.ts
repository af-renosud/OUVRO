export type AuditType = "database" | "application" | "data_persistence";

export interface AuditPrompt {
  id: AuditType;
  title: string;
  icon: string;
  description: string;
  prompt: string;
}

export const AUDIT_PROMPTS: AuditPrompt[] = [
  {
    id: "database",
    title: "Database Audit",
    icon: "database",
    description: "Validates PostgreSQL schema, Drizzle ORM mappings, and data integrity",
    prompt: `RUN DATABASE AUDIT FOR OUVRO

You are auditing the OUVRO mobile companion app's PostgreSQL database (Neon-backed, managed by Drizzle ORM).

SCHEMA TABLES TO VERIFY (defined in shared/schema.ts):
- users: id (varchar/UUID PK, gen_random_uuid()), username (text, unique, NOT NULL), password (text, NOT NULL)
- projects: id (serial PK), name (text, NOT NULL), location (text), status (text, default "active"), thumbnailUrl (text), createdAt/updatedAt (timestamps, NOT NULL)
- observations: id (serial PK), projectId (integer FK -> projects.id CASCADE), title (text, NOT NULL), description (text), transcription (text), translatedText (text), syncStatus (text, default "pending"), archidocProjectId (text), projectName (text), contractorName (text), contractorEmail (text), createdAt (timestamp, NOT NULL), syncedAt (timestamp)
- observation_media: id (serial PK), observationId (integer FK -> observations.id CASCADE), type (text, NOT NULL), localUri (text), remoteUrl (text), thumbnailUri (text), duration (integer), createdAt (timestamp, NOT NULL)
- project_files: id (serial PK), projectId (integer FK -> projects.id CASCADE), name (text, NOT NULL), type (text, NOT NULL), remoteUrl (text), localUri (text), fileSize (integer), isDownloaded (boolean, default false), createdAt (timestamp, NOT NULL)
- chat_messages: (defined in shared/models/chat.ts)

SHARED API CONTRACT (defined in shared/task-sync-types.ts):
- TaskSyncPayload: { localId, projectId, projectName, audioBase64?, transcription?, priority, classification, audioDuration, recordedAt, recordedBy }
- TaskSyncSuccessResponse: { success: true, localId, archidocTaskId }
- TaskSyncErrorResponse: { success: false, error, localId }
- TaskPriority: "low" | "normal" | "high" | "urgent"
- TaskClassification: "defect" | "action" | "followup" | "general"
NOTE: Voice tasks are NOT stored in OUVRO's PostgreSQL database. They are persisted on-device via AsyncStorage/DurableQueueStore and synced directly to ArchiDoc. The shared types above define the sync contract.

RELATIONS TO VERIFY:
- projects -> observations (one-to-many)
- projects -> projectFiles (one-to-many)
- observations -> observationMedia (one-to-many)
- All cascade deletes on foreign keys

AUDIT STEPS:
1. Run "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" to list all tables
2. For each table, run "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '<table>'" and compare against shared/schema.ts
3. Verify foreign key constraints exist: "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY'"
4. Check for orphaned records: observations without valid projectId, media without valid observationId
5. Verify indexes exist on foreign key columns for query performance
6. Check that syncStatus values in observations match expected enum: pending, uploading_metadata, uploading_media, partial, complete, failed, synced
7. Verify Drizzle schema in shared/schema.ts matches actual DB structure (run npm run db:push --force if mismatched)
8. Verify shared/task-sync-types.ts compiles and exports all expected types

REPORT FORMAT:
- Table-by-table comparison (schema.ts vs actual DB)
- Foreign key integrity status
- Orphaned record count
- Missing indexes
- Shared contract types validation
- Recommendations`,
  },
  {
    id: "application",
    title: "Application Audit",
    icon: "code",
    description: "Validates server routes, ARCHIDOC integration, Gemini AI, task sync, and client-server communication",
    prompt: `RUN APPLICATION AUDIT FOR OUVRO

You are auditing the OUVRO Express.js backend and its integrations with ARCHIDOC and Gemini AI. Routes are split into domain routers under server/routes/ and registered in server/routes.ts.

ROUTE ARCHITECTURE:
- server/routes.ts: registerRoutes() mounts all routers under /api prefix
- server/routes/projects.ts: projectsRouter (CRUD for projects and project files)
- server/routes/observations.ts: observationsRouter (CRUD for observations and media)
- server/routes/ai.ts: aiRouter (Gemini transcription and translation)
- server/routes/archidoc.ts: archidocRouter (ARCHIDOC proxy with requireArchidocUrl middleware)
- server/routes/sync.ts: syncRouter (observation sync, task sync, mark-synced)
- server/routes/archidoc-helpers.ts: shared utilities (archidocFetch, archidocJsonPost, formatServerError, requireArchidocUrl, buildArchidocObservationPayload)

ENVIRONMENT VARIABLES TO VERIFY:
- DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (PostgreSQL)
- AI_INTEGRATIONS_GEMINI_API_KEY, AI_INTEGRATIONS_GEMINI_BASE_URL (Gemini AI)
- EXPO_PUBLIC_ARCHIDOC_API_URL (should be https://archidoc-app-archidoc.replit.app)
- SESSION_SECRET

SERVER ROUTES TO TEST (all on port 5000):

Health:
1. GET /api/health -> { status: "ok", timestamp, uptime }

Projects (server/routes/projects.ts):
2. GET /api/projects -> array of projects from local DB
3. GET /api/projects/:id -> single project
4. POST /api/projects -> create project (body: { name, location?, status? })
5. GET /api/projects/:id/files -> project files from local DB
6. POST /api/projects/:id/files -> create project file record

Observations (server/routes/observations.ts):
7. GET /api/observations -> all observations (optional ?projectId filter)
8. GET /api/observations/pending -> pending observations with media and projectName
9. GET /api/observations/:id -> observation with media array
10. POST /api/observations -> create observation
11. PATCH /api/observations/:id -> update observation fields
12. DELETE /api/observations/:id -> delete observation (204)
13. POST /api/observations/:id/media -> add media to observation

Gemini AI (server/routes/ai.ts):
14. POST /api/transcribe -> { audioBase64, mimeType? } -> { transcription } (uses gemini-2.5-flash)
15. POST /api/translate -> { text, targetLanguage? } -> { translation } (defaults to French)

ARCHIDOC Proxy (server/routes/archidoc.ts — all use requireArchidocUrl middleware):
16. POST /api/archidoc/upload-url -> get signed upload URL from ARCHIDOC
17. POST /api/archidoc/proxy-upload -> full upload pipeline (get URL, upload binary, register asset)
18. POST /api/archidoc/register-asset -> register uploaded asset with observation
19. POST /api/archidoc/create-observation -> create field observation in ARCHIDOC

Sync (server/routes/sync.ts):
20. POST /api/sync-observation/:id -> sync local observation to ARCHIDOC (uses requireArchidocUrl)
21. POST /api/tasks/sync -> RESILIENT task sync endpoint (uses requireArchidocUrl):
    - Accepts TaskSyncPayload from shared/task-sync-types.ts
    - Validates: localId, projectId, at least one of transcription or audioBase64; priority, classification (enum check); transcription length < 10000
    - AUTO-TRANSCRIPTION: When audioBase64 is present but transcription is empty, calls Gemini AI to transcribe before forwarding to ArchiDoc. If transcription fails, sends empty transcription (does not block sync).
    - POSTs to ArchiDoc: \${archidocApiUrl}/api/ouvro/tasks
    - Returns 200 { success: true, localId, archidocTaskId } ONLY when ArchiDoc confirms (200/201)
    - Returns 502 { success: false, error, localId } when ArchiDoc fails
    - Returns 503/504 for network/timeout errors
    - Golden rule: NEVER returns 200 unless ArchiDoc confirmed receipt
22. POST /api/mark-synced/:id -> mark observation as synced

REMOVED ROUTES (verify these return 404):
- POST /api/voice-task -> DELETED (was fire-and-forget, caused data loss)

ARCHIDOC API FIELD MAPPING (client/lib/archidoc-api.ts):
- ARCHIDOC returns snake_case, app uses camelCase
- project_id -> id, project_name -> name, client_name -> clientName
- lotNumber/lot_number -> lotCode (DQE items)
- Multiple fallback fields for external links: photosUrl, photos_url, photoUrl, etc.
- Contractor fields: assignedContractorId, assigned_contractor_id, contractorId, contractor_id
- DQE attachments combined from both "attachments" and "projectAttachments" arrays

AUDIT STEPS:
1. curl http://localhost:5000/api/health and verify response
2. Test each CRUD route with curl (GET, POST, PATCH, DELETE)
3. Verify ARCHIDOC connectivity: curl the ARCHIDOC API URL /api/ouvro/projects
4. Test Gemini transcription with a small base64 audio sample
5. Check error handling: test with invalid IDs, missing fields, malformed JSON
6. Verify timeout handling (ARCHIDOC_TIMEOUT_MS = 15000, ARCHIDOC_UPLOAD_TIMEOUT_MS = 60000)
7. Check that archidocFetch properly aborts on timeout
8. Verify all env vars are set and non-empty
9. Test POST /api/tasks/sync with valid TaskSyncPayload — expect 502 (ArchiDoc endpoint may not exist yet) but verify validation works
10. Test POST /api/tasks/sync with missing fields — expect 400 with specific error messages
11. Verify POST /api/voice-task returns 404 (endpoint removed)
12. Test the proxy-upload pipeline end-to-end if possible

REPORT FORMAT:
- Route-by-route status (pass/fail with response codes)
- ARCHIDOC connectivity status
- Gemini AI connectivity status
- Task sync endpoint validation status
- Environment variable status
- Error handling coverage
- Recommendations`,
  },
  {
    id: "data_persistence",
    title: "Data Persistence Audit",
    icon: "hard-drive",
    description: "Validates offline sync queues, task sync engine, AsyncStorage, media file management, and sync state machines",
    prompt: `RUN DATA PERSISTENCE AUDIT FOR OUVRO

You are auditing OUVRO's TWO offline data persistence systems:
1. Observation sync: client/lib/offline-sync.ts + client/hooks/useOfflineSync.tsx
2. Task sync (store-and-forward): client/lib/offline-tasks.ts + client/hooks/useOfflineTasks.tsx

Both systems use the shared DurableQueueStore<T> (client/lib/durable-queue-store.ts) for AsyncStorage persistence and FileSystem durable copying.

=== SYSTEM 1: OBSERVATION SYNC ===

ASYNCSTORAGE KEYS:
- ouvro_pending_observations: JSON array of OfflineObservation objects
- ouvro_sync_settings: JSON SyncSettings object { wifiOnly, autoSync, maxRetries, retryDelayMs }
- ouvro_upload_progress: Upload progress tracking

OFFLINE OBSERVATION STRUCTURE:
{
  localId: string (obs_<timestamp>_<random>),
  projectId: string,
  archidocProjectId: string,
  projectName: string,
  title: string,
  description?: string,
  transcription?: string,
  translatedText?: string,
  contractorName?: string,
  contractorEmail?: string,
  media: OfflineMedia[],
  syncState: "pending" | "uploading_metadata" | "uploading_media" | "partial" | "complete" | "failed",
  remoteObservationId?: number,
  createdAt: string (ISO),
  modifiedAt: string (ISO),
  lastSyncAttempt?: string,
  lastSyncError?: string,
  syncCompletedAt?: string,
  retryCount: number,
  totalMediaSize: number,
  uploadedMediaSize: number
}

OBSERVATION SYNC STATE MACHINE:
pending -> uploading_metadata -> uploading_media -> complete
  |            |                    |
  v            v                    v
failed <--- failed <------------- partial (some media uploaded)

OBSERVATION DURABLE STORAGE:
- Media files copied from temp camera URIs to: FileSystem.documentDirectory + "ouvro_media/"
- Files renamed with timestamp prefix: <timestamp>_<originalName>
- Files with "mock://" prefix or already in ouvro_media/ are skipped

OBSERVATION NETWORK HANDLING:
- NetInfo listener for connectivity changes
- Auto-retry on reconnect if autoSync enabled
- Auto-retry interval: 120000ms (2 min)
- Max auto-retry attempts: 20
- Max backoff: 600000ms (10 min)
- WiFi-only mode respects settings.wifiOnly

OBSERVATION SYNC PIPELINE (startSync method):
1. Check network availability
2. Get all pending/failed observations
3. For each observation:
   a. Create observation in ARCHIDOC via POST /api/archidoc/create-observation
   b. Upload each media file via POST /api/archidoc/proxy-upload (base64 encoded)
   c. Update syncState at each step
   d. On failure: increment retryCount, set lastSyncError, mark as failed
   e. On success: mark as complete, set syncCompletedAt

OBSERVATION INTERRUPTED UPLOAD RECOVERY:
- On initialize(): observations in uploading_metadata/uploading_media reset to pending
- Media in "uploading" state reset to pending with progress 0
- Error message set to "Upload interrupted - will retry"

=== SYSTEM 2: TASK SYNC (STORE-AND-FORWARD) ===

ASYNCSTORAGE KEYS:
- ouvro_pending_tasks: JSON array of OfflineTask objects

OFFLINE TASK STRUCTURE (client/lib/offline-tasks.ts):
{
  localId: string (task_<timestamp>_<random>),
  projectId: string,
  projectName: string,
  audioUri: string,
  audioFileName: string,
  audioDuration: number,
  audioFileSize?: number,
  transcription?: string,
  editedTranscription?: string,
  priority: "low" | "normal" | "high" | "urgent",
  classification: "defect" | "action" | "followup" | "general",
  recordedAt: string (ISO),
  recordedBy: string (default "OUVRO Field User"),
  syncState: TaskSyncState,
  remoteTaskId?: string,
  createdAt: string (ISO),
  modifiedAt: string (ISO),
  lastSyncAttempt?: string,
  lastSyncError?: string,
  syncCompletedAt?: string,
  retryCount: number
}

TASK SYNC STATE MACHINE:
pending -> transcribing -> review -> accepted -> uploading -> complete
  |           |                                      |
  v           v                                      v
(reset)    (reset)                               accepted (retry)
                                                     |
                                                     v
                                                   failed (400 = bad data, no retry)

TASK SYNC RULES (CRITICAL — ZERO DATA LOSS):
- Tasks ONLY dequeue when server returns 200 OK (ArchiDoc confirmed receipt)
- On 502/503/504/network error: task reverts to "accepted" state, retryCount incremented
- On 400: task set to "failed" (bad data, no automatic retry)
- localId (UUID) travels through entire chain for idempotency
- Audio hits durable storage IMMEDIATELY on recording (before transcription)

TASK DURABLE STORAGE:
- Audio files copied from temp recording URIs to: FileSystem.documentDirectory + "ouvro_tasks/"
- Files renamed with timestamp prefix: <timestamp>_<originalName>
- Files with "mock://" prefix or already in ouvro_tasks/ are skipped

TASK SYNC PIPELINE (syncTask method):
1. Verify task is in "accepted" state (reject if not)
2. Set state to "uploading", persist to AsyncStorage
3. Build TaskSyncPayload from shared/task-sync-types.ts
4. POST to /api/tasks/sync with JSON payload
5. On 200: set state "complete", store remoteTaskId, set syncCompletedAt
6. On 400: set state "failed", store error (don't retry)
7. On 502/503/network: revert to "accepted", increment retryCount, store error
8. syncAllPending(): iterates all "accepted" tasks and syncs each sequentially

TASK INTERRUPTED UPLOAD RECOVERY (in initialize()):
- Tasks in "uploading" state reset to "accepted" with error "Upload interrupted - will retry"
- Tasks in "transcribing" state reset to "pending" with error "Transcription interrupted - will retry"

TASK SYNC CONTRACT (shared/task-sync-types.ts):
- TaskSyncPayload: { localId, projectId, projectName, audioBase64?, transcription?, priority, classification, audioDuration, recordedAt, recordedBy }
- Server endpoint: POST /api/tasks/sync -> forwards to ArchiDoc POST /api/ouvro/tasks
- AUTO-TRANSCRIPTION: When audioBase64 is present but transcription is empty, server calls Gemini AI to transcribe before forwarding. If transcription fails, sends with empty transcription (does not block sync).
- Server returns 200 ONLY when ArchiDoc confirms; 502/503 otherwise

=== SHARED INFRASTRUCTURE: DurableQueueStore<T> ===

File: client/lib/durable-queue-store.ts
- Generic class parameterized by T extends { localId: string }
- Methods: load(), save(items), copyToDurableStorage(uri, fileName), deleteFile(uri), subscribe(listener), emit(event, data)
- Constructor: (storageKey: string, durableSubdir: string, logPrefix: string)
- Observation instance: new DurableQueueStore("ouvro_pending_observations", "ouvro_media", "OfflineSync")
- Task instance: new DurableQueueStore("ouvro_pending_tasks", "ouvro_tasks", "OfflineTasks")

AUDIT STEPS:
1. Read client/lib/offline-sync.ts and verify observation state machine transitions
2. Read client/lib/offline-tasks.ts and verify task state machine transitions
3. Verify syncTask() enforces dequeue-only-on-200 rule (check all response code branches)
4. Verify AsyncStorage keys match expected format for both systems
5. Check that copyToDurableStorage correctly copies files and handles edge cases
6. Verify interrupted upload recovery logic in BOTH initialize() methods
7. Verify persist() correctly serializes to AsyncStorage in both systems
8. Check that clearCompleted() only removes items with syncState "complete" in both systems
9. Verify media/audio file cleanup happens for completed syncs
10. Check that TaskSyncPayload construction in syncTask() includes all required fields
11. Verify the useOfflineSync and useOfflineTasks React hooks correctly subscribe/unsubscribe to events
12. Verify DurableQueueStore is correctly instantiated with different storage keys for each system
13. Check that shared/task-sync-types.ts types are imported and used correctly in offline-tasks.ts

REPORT FORMAT:
- Observation state machine integrity (all transitions valid)
- Task state machine integrity (all transitions valid, dequeue-only-on-200 verified)
- AsyncStorage data format validation (both systems)
- Durable storage file management status (both systems)
- Network resilience coverage
- Error recovery completeness
- Store-and-forward contract compliance
- Recommendations`,
  },
];
