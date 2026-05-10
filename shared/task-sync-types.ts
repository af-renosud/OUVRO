export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskClassification = "defect" | "action" | "followup" | "general";

/**
 * Wire payload for `POST /api/tasks/sync` — the offline-first task
 * sync contract used by `client/lib/offline-tasks.ts` and consumed by
 * `server/routes/sync.ts`.
 *
 * Rules (source of truth — do NOT duplicate these in `replit.md`):
 * - Idempotency: `localId` is a client-generated UUID. The server uses
 *   it to dedupe retries; sending the same `localId` twice must not
 *   create two Archidoc tasks.
 * - At least one of `transcription` or `audioBase64` is required. The
 *   server returns 400 if both are missing.
 * - If only `audioBase64` is supplied, the server auto-transcribes it
 *   via Gemini before forwarding to Archidoc.
 * - The route returns 200 only when Archidoc confirms receipt; 502/503
 *   on Archidoc failure. The client must keep the task in its queue
 *   and retry on anything other than a 200.
 * - `transcription` is capped at 10 000 characters server-side.
 */
export interface TaskSyncPayload {
  localId: string;
  projectId: string;
  projectName: string;
  audioBase64?: string;
  transcription?: string;
  priority: TaskPriority;
  classification: TaskClassification;
  audioDuration: number;
  recordedAt: string;
  recordedBy: string;
}

/** Returned with HTTP 200 when Archidoc has confirmed receipt. */
export interface TaskSyncSuccessResponse {
  success: true;
  localId: string;
  archidocTaskId: string;
}

/** Returned with 4xx/5xx; client keeps the task queued and retries. */
export interface TaskSyncErrorResponse {
  success: false;
  error: string;
  localId: string;
}
