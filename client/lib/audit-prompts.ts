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
- users: id (varchar/UUID PK), username (text, unique, NOT NULL), password (text, NOT NULL)
- projects: id (serial PK), name (text, NOT NULL), location (text), status (text, default "active"), thumbnailUrl (text), createdAt/updatedAt (timestamps)
- observations: id (serial PK), projectId (integer FK -> projects.id CASCADE), title (text, NOT NULL), description (text), transcription (text), translatedText (text), syncStatus (text, default "pending"), archidocProjectId (text), projectName (text), contractorName (text), contractorEmail (text), createdAt (timestamp), syncedAt (timestamp)
- observation_media: id (serial PK), observationId (integer FK -> observations.id CASCADE), type (text, NOT NULL), localUri (text), remoteUrl (text), thumbnailUri (text), duration (integer), createdAt (timestamp)
- project_files: id (serial PK), projectId (integer FK -> projects.id CASCADE), name (text, NOT NULL), type (text, NOT NULL), remoteUrl (text), localUri (text), fileSize (integer), isDownloaded (boolean, default false), createdAt (timestamp)
- chat_messages: (defined in shared/models/chat.ts)

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

REPORT FORMAT:
- Table-by-table comparison (schema.ts vs actual DB)
- Foreign key integrity status
- Orphaned record count
- Missing indexes
- Recommendations`,
  },
  {
    id: "application",
    title: "Application Audit",
    icon: "code",
    description: "Validates server routes, ARCHIDOC integration, Gemini AI, and client-server communication",
    prompt: `RUN APPLICATION AUDIT FOR OUVRO

You are auditing the OUVRO Express.js backend (server/routes.ts) and its integrations with ARCHIDOC and Gemini AI.

ENVIRONMENT VARIABLES TO VERIFY:
- DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (PostgreSQL)
- AI_INTEGRATIONS_GEMINI_API_KEY, AI_INTEGRATIONS_GEMINI_BASE_URL (Gemini AI)
- EXPO_PUBLIC_ARCHIDOC_API_URL (should be https://archidoc-app-archidoc.replit.app)
- SESSION_SECRET

SERVER ROUTES TO TEST (all on port 5000):
1. GET /api/health -> { status: "ok", timestamp, uptime }
2. GET /api/projects -> array of projects from local DB
3. GET /api/projects/:id -> single project
4. POST /api/projects -> create project (body: { name, location?, status? })
5. GET /api/observations -> all observations (optional ?projectId filter)
6. GET /api/observations/pending -> pending observations with media and projectName
7. GET /api/observations/:id -> observation with media array
8. POST /api/observations -> create observation
9. PATCH /api/observations/:id -> update observation fields
10. DELETE /api/observations/:id -> delete observation (204)
11. POST /api/observations/:id/media -> add media to observation
12. GET /api/projects/:id/files -> project files from local DB
13. POST /api/projects/:id/files -> create project file record

GEMINI AI ROUTES:
14. POST /api/transcribe -> { audioBase64, mimeType? } -> { transcription } (uses gemini-2.5-flash)
15. POST /api/translate -> { text, targetLanguage? } -> { translation } (defaults to French)

ARCHIDOC PROXY ROUTES:
16. POST /api/archidoc/upload-url -> get signed upload URL from ARCHIDOC
17. POST /api/archidoc/proxy-upload -> full upload pipeline (get URL, upload binary, register asset)
18. POST /api/archidoc/register-asset -> register uploaded asset with observation
19. POST /api/archidoc/create-observation -> create field observation in ARCHIDOC
20. POST /api/sync-observation/:id -> sync local observation to ARCHIDOC
21. POST /api/mark-synced/:id -> mark observation as synced

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
9. Test the proxy-upload pipeline end-to-end if possible

REPORT FORMAT:
- Route-by-route status (pass/fail with response codes)
- ARCHIDOC connectivity status
- Gemini AI connectivity status  
- Environment variable status
- Error handling coverage
- Recommendations`,
  },
  {
    id: "data_persistence",
    title: "Data Persistence Audit",
    icon: "hard-drive",
    description: "Validates offline sync queue, AsyncStorage, media file management, and sync state machine",
    prompt: `RUN DATA PERSISTENCE AUDIT FOR OUVRO

You are auditing OUVRO's offline data persistence layer (client/lib/offline-sync.ts and client/hooks/useOfflineSync.tsx).

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

OFFLINE MEDIA STRUCTURE:
{
  id: string (media_<timestamp>_<random>),
  type: "photo" | "video" | "audio",
  localUri: string,
  fileName: string,
  contentType: string (image/jpeg, video/mp4, audio/m4a),
  fileSize?: number,
  syncState: "pending" | "uploading" | "complete" | "failed",
  uploadProgress: number (0-100),
  retryCount: number,
  lastError?: string,
  remoteUrl?: string
}

SYNC STATE MACHINE:
pending -> uploading_metadata -> uploading_media -> complete
  |            |                    |
  v            v                    v
failed <--- failed <------------- partial (some media uploaded)

DURABLE STORAGE:
- Media files copied from temp camera URIs to: FileSystem.documentDirectory + "ouvro_media/"
- Files renamed with timestamp prefix: <timestamp>_<originalName>
- Files with "mock://" prefix or already in ouvro_media/ are skipped

NETWORK HANDLING:
- NetInfo listener for connectivity changes
- Auto-retry on reconnect if autoSync enabled
- Auto-retry interval: 120000ms (2 min)
- Max auto-retry attempts: 20
- Max backoff: 600000ms (10 min)
- WiFi-only mode respects settings.wifiOnly

SYNC PIPELINE (startSync method):
1. Check network availability
2. Get all pending/failed observations
3. For each observation:
   a. Create observation in ARCHIDOC via POST /api/archidoc/create-observation
   b. Upload each media file via POST /api/archidoc/proxy-upload (base64 encoded)
   c. Update syncState at each step
   d. On failure: increment retryCount, set lastSyncError, mark as failed
   e. On success: mark as complete, set syncCompletedAt

INTERRUPTED UPLOAD RECOVERY:
- On initialize(): observations in uploading_metadata/uploading_media reset to pending
- Media in "uploading" state reset to pending with progress 0
- Error message set to "Upload interrupted - will retry"

AUDIT STEPS:
1. Read client/lib/offline-sync.ts and verify state machine transitions
2. Verify AsyncStorage keys match expected format
3. Check that copyToDurableStorage correctly copies files and handles edge cases
4. Verify interrupted upload recovery logic in initialize()
5. Test sync pipeline: add observation -> start sync -> verify state transitions
6. Check error parsing in parseErrorMessage() covers all server error formats
7. Verify persist() correctly serializes all observations to AsyncStorage
8. Check that clearCompleted() only removes observations with syncState "complete"
9. Verify media file cleanup happens for completed syncs
10. Check SyncProgress tracking accuracy during multi-file uploads
11. Verify the useOfflineSync React hook correctly subscribes/unsubscribes to events
12. Check that createOfflineMedia helper generates correct contentType mappings

REPORT FORMAT:
- State machine integrity (all transitions valid)
- AsyncStorage data format validation
- Durable storage file management status
- Network resilience coverage
- Error recovery completeness
- Recommendations`,
  },
];
