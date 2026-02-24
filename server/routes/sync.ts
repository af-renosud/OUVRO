import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import {
  requireArchidocUrl,
  archidocFetch,
  archidocJsonPost,
  buildArchidocObservationPayload,
  formatServerError,
  ARCHIDOC_UPLOAD_TIMEOUT_MS,
} from "./archidoc-helpers";

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

// TODO: Stub route — ARCHIDOC voice-task endpoint not yet implemented.
// Replace with real ARCHIDOC integration when available.
syncRouter.post("/tasks/sync", async (req: Request, res: Response) => {
  try {
    const { projectId, projectName, transcription, audioDuration, localId } = req.body;

    if (!projectId || !transcription) {
      return res.status(400).json({ error: "Missing required fields: projectId, transcription" });
    }

    console.log(`[Task Sync] Received task for project ${projectId} (${projectName}): "${transcription.substring(0, 80)}..."`);

    res.json({
      success: true,
      taskId: `archidoc_task_${Date.now()}`,
      localId,
      message: "Task received. ARCHIDOC endpoint not yet implemented - task stored locally.",
    });
  } catch (error) {
    console.error("[Task Sync] Error:", error);
    res.status(500).json({ error: "Failed to sync task" });
  }
});

syncRouter.post("/voice-task", requireArchidocUrl, async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, project_id, recorded_by, recorded_at, priority, classification } = req.body;

    if (!audioBase64 || !project_id) {
      return res.status(400).json({ error: "audioBase64 and project_id are required" });
    }

    const archidocApiUrl = res.locals.archidocApiUrl;

    const fileBuffer = Buffer.from(audioBase64, "base64");
    const fileExtension = mimeType === "audio/mpeg" ? "mp3" : "m4a";
    const fileName = `voice-task-${Date.now()}.${fileExtension}`;

    console.log(`[VoiceTask] Uploading ${fileBuffer.length} bytes for project ${project_id}`);

    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    addField("project_id", project_id);
    addField("recorded_by", recorded_by || "OUVRO Field User");
    if (recorded_at) addField("recorded_at", recorded_at);
    if (priority) addField("priority", priority);
    if (classification) addField("classification", classification);

    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType || "audio/mp4"}\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const archidocResponse = await archidocFetch(`${archidocApiUrl}/api/ouvro/voice-task`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body: body,
      timeout: ARCHIDOC_UPLOAD_TIMEOUT_MS,
    });

    if (!archidocResponse.ok) {
      const errorText = await archidocResponse.text();
      console.error("[VoiceTask] ArchiDoc error:", archidocResponse.status, errorText);
      return res.status(archidocResponse.status).json({
        error: errorText || "ArchiDoc rejected the voice task",
      });
    }

    const result = await archidocResponse.json();
    console.log("[VoiceTask] Task created successfully:", result.task_id);

    res.json(result);
  } catch (error) {
    const { status, message } = formatServerError(error, "Voice Task");
    res.status(status).json({ error: message });
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
