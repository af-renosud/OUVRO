import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import {
  requireArchidocUrl,
  archidocJsonPost,
  formatServerError,
} from "./archidoc-helpers";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export const dqeRouter = Router();

async function transcribeVideoNarration(videoUrl: string): Promise<string> {
  let videoBuffer: ArrayBuffer;
  try {
    const videoResponse = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video for transcription: ${videoResponse.status}`);
    }
    videoBuffer = await videoResponse.arrayBuffer();
  } catch (fetchErr: unknown) {
    throw new Error(`Video download failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
  }

  const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

  const uploadedFile = await ai.files.upload({
    file: videoBlob,
    config: {
      mimeType: "video/mp4",
      displayName: `dqe_narration_${Date.now()}`,
    },
  });

  const fileUri = uploadedFile.uri;
  if (!fileUri) {
    throw new Error("Gemini Files API returned no URI for uploaded video");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcris la narration de cet architecte sur le chantier. Concentre-toi sur les observations de construction, défauts, numéros de lot, références aux entreprises. Reproduis le texte tel quel, sans reformulation ni résumé.",
          },
          {
            fileData: { mimeType: "video/mp4", fileUri },
          },
        ],
      },
    ],
  });

  return response.text?.trim() || "";
}

type DQESubmitPayload = {
  localId: string;
  projectId: string;
  projectName: string;
  videoObjectPath: string;
  videoUrl?: string;
  transcription?: string;
  architectNotes?: string;
  videoDuration: number;
  qualityTier: string;
  capturedAt: string;
  capturedBy: string;
};

dqeRouter.post("/dqe/submit", requireArchidocUrl, async (req: Request, res: Response) => {
  const localId: string = req.body.localId || "unknown";

  try {
    const {
      projectId,
      projectName,
      videoObjectPath,
      videoUrl,
      architectNotes,
      videoDuration,
      qualityTier,
      capturedAt,
      capturedBy,
    } = req.body as DQESubmitPayload;

    console.log(`[DQE Submit] localId=${localId} — received DQE submission`);

    if (!localId || localId === "unknown") {
      return res.status(400).json({ success: false, error: "Missing required field: localId", localId });
    }
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Missing required field: projectId", localId });
    }
    if (!videoObjectPath) {
      return res.status(400).json({ success: false, error: "Missing required field: videoObjectPath", localId });
    }

    let transcription: string | undefined;
    if (videoUrl) {
      try {
        console.log(`[DQE Submit] localId=${localId} — transcribing video narration via Gemini`);
        transcription = await transcribeVideoNarration(videoUrl);
        console.log(`[DQE Submit] localId=${localId} — transcription complete (${transcription.length} chars)`);
      } catch (transcribeErr: unknown) {
        console.warn(
          `[DQE Submit] localId=${localId} — transcription failed (non-blocking):`,
          transcribeErr instanceof Error ? transcribeErr.message : transcribeErr
        );
      }
    } else {
      console.log(`[DQE Submit] localId=${localId} — no videoUrl provided, skipping transcription`);
    }

    const archidocApiUrl = res.locals.archidocApiUrl;

    const payload: DQESubmitPayload & { transcription?: string } = {
      localId,
      projectId,
      projectName: projectName || "Unknown Project",
      videoObjectPath,
      videoUrl,
      videoDuration: videoDuration || 0,
      qualityTier: qualityTier || "standard",
      capturedAt: capturedAt || new Date().toISOString(),
      capturedBy: capturedBy || "OUVRO Field User",
    };

    if (architectNotes) payload.architectNotes = architectNotes;
    if (transcription) payload.transcription = transcription;

    console.log(`[DQE Submit] localId=${localId} — posting to ArchiDoc DQE for project ${projectId}`);

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/ouvro/dqe/capture`,
      payload,
      "Submit DQE capture to ArchiDoc",
      60000
    );

    if ("error" in result) {
      console.warn(`[DQE Submit] localId=${localId} — ArchiDoc returned error: ${result.error} (status ${result.status})`);
      return res.status(502).json({ success: false, error: result.error, localId });
    }

    const archidocDQEId =
      result.data?.id ||
      result.data?.dqeId ||
      result.data?.dqe_id ||
      result.data?.captureId ||
      `dqe_archidoc_${Date.now()}`;

    console.log(`[DQE Submit] localId=${localId} — successfully submitted, archidocDQEId=${archidocDQEId}`);

    return res.status(200).json({ success: true, localId, archidocDQEId, transcription });
  } catch (error: unknown) {
    console.error(`[DQE Submit] localId=${localId} — unexpected error:`, error);
    const { status, message } = formatServerError(error, "DQE Submit");
    const responseStatus = status === 503 || status === 504 ? status : 502;
    return res.status(responseStatus).json({ success: false, error: message, localId });
  }
});
