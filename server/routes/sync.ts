import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import {
  requireArchidocUrl,
  archidocJsonPost,
  buildArchidocObservationPayload,
  formatServerError,
} from "./archidoc-helpers";
import type { TaskSyncPayload, TaskSyncSuccessResponse, TaskSyncErrorResponse } from "../../shared/task-sync-types";

export const syncRouter = Router();

syncRouter.post("/sync-observation/:id", requireArchidocUrl, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const observation = await storage.getObservation(id);
    if (!observation) {
      return res.status(404).json({ error: "Observation not found" });
    }

    const archidocApiUrl = res.locals.archidocApiUrl;

    if (!observation.archidocProjectId) {
      return res.status(400).json({ error: "No ARCHIDOC project ID associated with this observation" });
    }

    const archidocPayload = buildArchidocObservationPayload({
      projectId: observation.archidocProjectId,
      title: observation.title,
      description: observation.description,
      observedAt: observation.createdAt?.toISOString(),
      transcription: observation.transcription,
      translatedText: observation.translatedText,
    });

    console.log("[Sync] Observation from DB:", JSON.stringify({
      id: observation.id,
      title: observation.title,
      transcription: observation.transcription,
      translatedText: observation.translatedText,
    }));
    console.log("[Sync] Payload to ARCHIDOC:", JSON.stringify(archidocPayload));

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations`,
      archidocPayload,
      "Sync observation to ARCHIDOC"
    );

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    console.log("Successfully created observation in ARCHIDOC, ID:", result.data.id);

    res.json({
      localId: id,
      archidocObservationId: result.data.id,
      observation,
    });
  } catch (error) {
    const { status, message } = formatServerError(error, "Sync observation");
    res.status(status).json({ error: message });
  }
});

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
    if (!transcription) {
      return res.status(400).json({ success: false, error: "Missing required field: transcription", localId } as TaskSyncErrorResponse);
    }
    if (transcription.length > 10000) {
      return res.status(400).json({ success: false, error: "Transcription exceeds maximum length of 10000 characters", localId } as TaskSyncErrorResponse);
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, error: `Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}`, localId } as TaskSyncErrorResponse);
    }
    if (classification && !VALID_CLASSIFICATIONS.includes(classification)) {
      return res.status(400).json({ success: false, error: `Invalid classification: ${classification}. Must be one of: ${VALID_CLASSIFICATIONS.join(", ")}`, localId } as TaskSyncErrorResponse);
    }

    const archidocApiUrl = res.locals.archidocApiUrl;

    const archidocPayload = {
      localId,
      projectId,
      transcription,
      priority: priority || "normal",
      classification: classification || "general",
      audioDuration: audioDuration || 0,
      recordedAt: recordedAt || new Date().toISOString(),
      recordedBy: recordedBy || "OUVRO Field User",
    };

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

syncRouter.post("/mark-synced/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updatedObservation = await storage.updateObservation(id, {
      syncStatus: "synced",
    });
    res.json(updatedObservation);
  } catch (error) {
    console.error("Error marking observation as synced:", error);
    res.status(500).json({ error: "Failed to mark observation as synced" });
  }
});
