import { Router, type Request, type Response } from "express";
import { transcribeAudio } from "./ai-helpers";
import {
  requireArchidocUrl,
  archidocJsonPost,
  formatServerError,
} from "./archidoc-helpers";
import type { TaskSyncPayload, TaskSyncSuccessResponse, TaskSyncErrorResponse } from "../../shared/task-sync-types";

export const syncRouter = Router();

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const VALID_CLASSIFICATIONS = ["defect", "action", "followup", "general"] as const;

syncRouter.post("/tasks/sync", requireArchidocUrl, async (req: Request, res: Response) => {
  const localId: string = req.body.localId || "unknown";

  try {
    const { projectId, projectName, transcription, priority, classification, audioDuration, recordedAt, recordedBy } = req.body as TaskSyncPayload;

    console.log(`[Task Sync] localId=${localId} — received sync request`);

    if (!localId || localId === "unknown") {
      return res.status(400).json({ success: false, error: "Missing required field: localId", localId } as TaskSyncErrorResponse);
    }
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Missing required field: projectId", localId } as TaskSyncErrorResponse);
    }
    const audioBase64 = req.body.audioBase64;
    if (!transcription && !audioBase64) {
      return res.status(400).json({ success: false, error: "At least one of transcription or audioBase64 is required", localId } as TaskSyncErrorResponse);
    }
    if (transcription && transcription.length > 10000) {
      return res.status(400).json({ success: false, error: "Transcription exceeds maximum length of 10000 characters", localId } as TaskSyncErrorResponse);
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, error: `Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}`, localId } as TaskSyncErrorResponse);
    }
    if (classification && !VALID_CLASSIFICATIONS.includes(classification)) {
      return res.status(400).json({ success: false, error: `Invalid classification: ${classification}. Must be one of: ${VALID_CLASSIFICATIONS.join(", ")}`, localId } as TaskSyncErrorResponse);
    }

    const archidocApiUrl = res.locals.archidocApiUrl;

    let finalTranscription = transcription || "";
    if (!finalTranscription && audioBase64) {
      console.log(`[Task Sync] localId=${localId} — no transcription provided, auto-transcribing audio`);
      try {
        finalTranscription = await transcribeAudio(audioBase64);
        console.log(`[Task Sync] localId=${localId} — auto-transcription complete (${finalTranscription.length} chars)`);
      } catch (transcribeErr: unknown) {
        const errMsg = transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr);
        console.warn(`[Task Sync] localId=${localId} — auto-transcription failed: ${errMsg}. Sending with empty transcription.`);
      }
    }

    const titleText = finalTranscription
      ? finalTranscription.substring(0, 80).replace(/\n/g, " ").trim() + (finalTranscription.length > 80 ? "..." : "")
      : "Audio task (not yet transcribed)";

    const archidocPayload: Record<string, any> = {
      localId,
      projectId,
      title: titleText,
      transcription: finalTranscription,
      priority: priority || "normal",
      classification: classification || "general",
      audioDuration: audioDuration || 0,
      recordedAt: recordedAt || new Date().toISOString(),
      recordedBy: recordedBy || "OUVRO Field User",
    };
    if (audioBase64) {
      archidocPayload.audioBase64 = audioBase64;
    }

    console.log(`[Task Sync] localId=${localId} — posting to ArchiDoc for project ${projectId}`);

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/ouvro/tasks`,
      archidocPayload,
      "Sync task to ArchiDoc"
    );

    if ("error" in result) {
      console.warn(`[Task Sync] localId=${localId} — ArchiDoc returned error: ${result.error} (status ${result.status})`);
      return res.status(502).json({ success: false, error: result.error, localId } as TaskSyncErrorResponse);
    }

    const archidocTaskId = result.data?.id || result.data?.taskId || result.data?.task_id || `archidoc_${Date.now()}`;
    console.log(`[Task Sync] localId=${localId} — successfully synced, archidocTaskId=${archidocTaskId}`);

    return res.status(200).json({ success: true, localId, archidocTaskId } as TaskSyncSuccessResponse);
  } catch (error) {
    console.error(`[Task Sync] localId=${localId} — unexpected error:`, error);
    const { status, message } = formatServerError(error, "Task Sync");
    const responseStatus = status === 503 || status === 504 ? status : 502;
    return res.status(responseStatus).json({ success: false, error: message, localId } as TaskSyncErrorResponse);
  }
});
