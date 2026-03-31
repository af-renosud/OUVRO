import { Router, type Request, type Response } from "express";
import {
  requireArchidocUrl,
  archidocFetch,
  archidocJsonPost,
  buildArchidocObservationPayload,
  formatServerError,
  ARCHIDOC_UPLOAD_TIMEOUT_MS,
} from "./archidoc-helpers";

export const archidocRouter = Router();

archidocRouter.use(requireArchidocUrl);

archidocRouter.post("/archidoc/upload-url", async (req: Request, res: Response) => {
  try {
    const { fileName, contentType, assetType } = req.body;
    const archidocApiUrl = res.locals.archidocApiUrl;

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations/upload-url`,
      { fileName, contentType, assetType },
      "Upload URL request"
    );

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    const { status, message } = formatServerError(error, "Upload URL request");
    res.status(status).json({ error: message });
  }
});

archidocRouter.post("/archidoc/download-url", async (req: Request, res: Response) => {
  try {
    const { objectPath } = req.body;
    if (!objectPath) {
      return res.status(400).json({ error: "objectPath is required" });
    }
    const archidocApiUrl = res.locals.archidocApiUrl;

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations/download-url`,
      { objectPath },
      "Download URL request"
    );

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    const { status, message } = formatServerError(error, "Download URL request");
    res.status(status).json({ error: message });
  }
});

archidocRouter.post("/archidoc/register-asset", async (req: Request, res: Response) => {
  try {
    const { observationId, assetType, objectPath, fileName, mimeType } = req.body;
    const archidocApiUrl = res.locals.archidocApiUrl;

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations/${observationId}/assets`,
      { assetType, objectPath, fileName, mimeType },
      "Register asset"
    );

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    const { status, message } = formatServerError(error, "Register asset");
    res.status(status).json({ error: message });
  }
});

archidocRouter.post("/archidoc/create-observation", async (req: Request, res: Response) => {
  try {
    const { projectId, title, description, transcription, translatedText, contractorName } = req.body;
    const archidocApiUrl = res.locals.archidocApiUrl;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const archidocPayload = buildArchidocObservationPayload({
      projectId,
      title,
      description,
      observedBy: contractorName,
      transcription,
      translatedText,
    });

    console.log("[CreateObs] Sending to ARCHIDOC:", JSON.stringify(archidocPayload));

    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations`,
      archidocPayload,
      "Create observation in ARCHIDOC"
    );

    if ("error" in result) {
      return res.status(500).json({ error: result.error });
    }

    const obsData = result.data as Record<string, unknown>;
    console.log("[CreateObs] Created in ARCHIDOC, ID:", obsData.id);
    res.json({ archidocObservationId: obsData.id });
  } catch (error) {
    const { status, message } = formatServerError(error, "Create observation");
    res.status(status).json({ error: message });
  }
});
