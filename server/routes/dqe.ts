import { Router, type Request, type Response } from "express";
import {
  requireArchidocUrl,
  archidocJsonPost,
  formatServerError,
} from "./archidoc-helpers";

export const dqeRouter = Router();

dqeRouter.post("/dqe/submit", requireArchidocUrl, async (req: Request, res: Response) => {
  const localId: string = req.body.localId || "unknown";

  try {
    const {
      projectId,
      projectName,
      videoObjectPath,
      architectNotes,
      videoDuration,
      qualityTier,
      capturedAt,
      capturedBy,
    } = req.body;

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

    const archidocApiUrl = res.locals.archidocApiUrl;

    const payload: Record<string, any> = {
      localId,
      projectId,
      projectName: projectName || "Unknown Project",
      videoObjectPath,
      videoDuration: videoDuration || 0,
      qualityTier: qualityTier || "standard",
      capturedAt: capturedAt || new Date().toISOString(),
      capturedBy: capturedBy || "OUVRO Field User",
    };
    if (architectNotes) {
      payload.architectNotes = architectNotes;
    }

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

    return res.status(200).json({ success: true, localId, archidocDQEId });
  } catch (error) {
    console.error(`[DQE Submit] localId=${localId} — unexpected error:`, error);
    const { status, message } = formatServerError(error, "DQE Submit");
    const responseStatus = status === 503 || status === 504 ? status : 502;
    return res.status(responseStatus).json({ success: false, error: message, localId });
  }
});
