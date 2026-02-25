import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import {
  requireArchidocUrl,
  archidocFetch,
  archidocJsonPost,
  buildArchidocObservationPayload,
  formatServerError,
  ARCHIDOC_UPLOAD_TIMEOUT_MS,
} from "./archidoc-helpers";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

async function transcribeWithGemini(audioBase64: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else." },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });
  return response.text || "";
}

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

syncRouter.post("/voice-task", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = "audio/mp4", project_id, recorded_by, recorded_at, priority, classification } = req.body;

    if (!audioBase64 || !project_id) {
      return res.status(400).json({ error: "audioBase64 and project_id are required" });
    }

    const archidocApiUrl = process.env.ARCHIDOC_API_URL;
    let archidocResult: any = null;

    if (archidocApiUrl) {
      try {
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
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
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

        if (archidocResponse.ok) {
          archidocResult = await archidocResponse.json();
          console.log("[VoiceTask] Task created in ArchiDoc:", archidocResult.task_id);
          return res.json(archidocResult);
        }

        const errorText = await archidocResponse.text();
        console.warn(`[VoiceTask] ArchiDoc returned ${archidocResponse.status}, falling back to Gemini transcription`);
      } catch (archidocError: any) {
        console.warn("[VoiceTask] ArchiDoc unavailable, falling back to Gemini transcription:", archidocError.message);
      }
    } else {
      console.log("[VoiceTask] No ARCHIDOC_API_URL configured, using Gemini transcription");
    }

    console.log("[VoiceTask] Transcribing with Gemini...");
    const transcription = await transcribeWithGemini(audioBase64, mimeType);
    const taskTitle = transcription.length > 80
      ? transcription.substring(0, 77) + "..."
      : transcription;

    console.log("[VoiceTask] Gemini transcription complete:", taskTitle);

    res.json({
      task_id: `local-${Date.now()}`,
      transcription,
      task_title: taskTitle,
      source: "gemini-fallback",
    });
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
