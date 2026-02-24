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

archidocRouter.post("/archidoc/proxy-upload", async (req: Request, res: Response) => {
  try {
    const { observationId, fileName, contentType, assetType, fileBase64 } = req.body;
    const archidocApiUrl = res.locals.archidocApiUrl;

    console.log(`[Proxy Upload] Starting upload for ${assetType}: ${fileName}`);

    const urlResult = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations/upload-url`,
      { fileName, contentType, assetType },
      "Get upload URL"
    );

    if ("error" in urlResult) {
      return res.status(500).json({ error: "Failed to get upload URL from ARCHIDOC" });
    }

    const { uploadURL, objectPath } = urlResult.data;
    console.log(`[Proxy Upload] Got upload URL, objectPath: ${objectPath}`);

    const fileBuffer = Buffer.from(fileBase64, "base64");
    console.log(`[Proxy Upload] Uploading ${fileBuffer.length} bytes to storage...`);

    const uploadResponse = await archidocFetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: fileBuffer,
      timeout: ARCHIDOC_UPLOAD_TIMEOUT_MS,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[Proxy Upload] Failed to upload to storage:", uploadResponse.status, errorText);
      return res.status(500).json({ error: "Failed to upload file to storage" });
    }

    console.log(`[Proxy Upload] Upload successful, registering asset...`);

    const registerResult = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations/${observationId}/assets`,
      { assetType, objectPath, fileName, mimeType: contentType },
      "Register asset"
    );

    if ("error" in registerResult) {
      return res.status(500).json({ error: "Failed to register asset in ARCHIDOC" });
    }

    console.log(`[Proxy Upload] Asset registered successfully: ${fileName}`);

    res.json({ success: true, asset: registerResult.data, objectPath });
  } catch (error) {
    const { status, message } = formatServerError(error, "Proxy Upload");
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

    console.log("[CreateObs] Created in ARCHIDOC, ID:", result.data.id);
    res.json({ archidocObservationId: result.data.id });
  } catch (error) {
    const { status, message } = formatServerError(error, "Create observation");
    res.status(status).json({ error: message });
  }
});
