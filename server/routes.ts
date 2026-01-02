import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertProjectSchema, insertObservationSchema, insertObservationMediaSchema, insertProjectFileSchema } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  registerChatRoutes(app);
  registerImageRoutes(app);

  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const project = await storage.createProject(parsed.data);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.get("/api/observations", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const observations = await storage.getObservations(projectId);
      res.json(observations);
    } catch (error) {
      console.error("Error fetching observations:", error);
      res.status(500).json({ error: "Failed to fetch observations" });
    }
  });

  app.get("/api/observations/pending", async (req: Request, res: Response) => {
    try {
      const observations = await storage.getPendingObservations();
      const observationsWithMedia = await Promise.all(
        observations.map(async (obs) => {
          const media = await storage.getObservationMedia(obs.id);
          const project = await storage.getProject(obs.projectId);
          return {
            ...obs,
            media,
            projectName: obs.projectName || project?.name || "Unknown Project",
          };
        })
      );
      res.json(observationsWithMedia);
    } catch (error) {
      console.error("Error fetching pending observations:", error);
      res.status(500).json({ error: "Failed to fetch pending observations" });
    }
  });

  app.get("/api/observations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const observation = await storage.getObservation(id);
      if (!observation) {
        return res.status(404).json({ error: "Observation not found" });
      }
      const media = await storage.getObservationMedia(id);
      res.json({ ...observation, media });
    } catch (error) {
      console.error("Error fetching observation:", error);
      res.status(500).json({ error: "Failed to fetch observation" });
    }
  });

  app.post("/api/observations", async (req: Request, res: Response) => {
    try {
      const parsed = insertObservationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const observation = await storage.createObservation(parsed.data);
      res.status(201).json(observation);
    } catch (error) {
      console.error("Error creating observation:", error);
      res.status(500).json({ error: "Failed to create observation" });
    }
  });

  app.patch("/api/observations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const observation = await storage.updateObservation(id, req.body);
      if (!observation) {
        return res.status(404).json({ error: "Observation not found" });
      }
      res.json(observation);
    } catch (error) {
      console.error("Error updating observation:", error);
      res.status(500).json({ error: "Failed to update observation" });
    }
  });

  app.delete("/api/observations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteObservation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting observation:", error);
      res.status(500).json({ error: "Failed to delete observation" });
    }
  });

  app.post("/api/observations/:id/media", async (req: Request, res: Response) => {
    try {
      const observationId = parseInt(req.params.id);
      const parsed = insertObservationMediaSchema.safeParse({ ...req.body, observationId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const media = await storage.createObservationMedia(parsed.data);
      res.status(201).json(media);
    } catch (error) {
      console.error("Error creating media:", error);
      res.status(500).json({ error: "Failed to create media" });
    }
  });

  app.get("/api/projects/:id/files", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = await storage.getProjectFiles(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching project files:", error);
      res.status(500).json({ error: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      const parsed = insertProjectFileSchema.safeParse({ ...req.body, projectId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const file = await storage.createProjectFile(parsed.data);
      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating project file:", error);
      res.status(500).json({ error: "Failed to create project file" });
    }
  });

  app.post("/api/transcribe", async (req: Request, res: Response) => {
    try {
      const { audioBase64 } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else." },
              {
                inlineData: {
                  mimeType: "audio/mp3",
                  data: audioBase64,
                },
              },
            ],
          },
        ],
      });

      const transcription = response.text || "";
      res.json({ transcription });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.post("/api/translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage = "French" } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Translate the following text to ${targetLanguage}. Only output the translation, nothing else:\n\n${text}` },
            ],
          },
        ],
      });

      const translation = response.text || "";
      res.json({ translation });
    } catch (error) {
      console.error("Error translating text:", error);
      res.status(500).json({ error: "Failed to translate text" });
    }
  });

  app.post("/api/archidoc/upload-url", async (req: Request, res: Response) => {
    try {
      const { fileName, contentType, assetType } = req.body;
      
      const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
      if (!archidocApiUrl) {
        return res.status(500).json({ error: "ARCHIDOC API URL not configured" });
      }

      const response = await fetch(`${archidocApiUrl}/api/field-observations/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName, contentType, assetType }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to get upload URL:", errorText);
        return res.status(response.status).json({ error: "Failed to get upload URL from ARCHIDOC" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/archidoc/proxy-upload", async (req: Request, res: Response) => {
    try {
      const { observationId, fileName, contentType, assetType, fileBase64 } = req.body;
      
      const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
      if (!archidocApiUrl) {
        return res.status(500).json({ error: "ARCHIDOC API URL not configured" });
      }

      console.log(`[Proxy Upload] Starting upload for ${assetType}: ${fileName}`);

      const urlResponse = await fetch(`${archidocApiUrl}/api/field-observations/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, contentType, assetType }),
      });

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        console.error("[Proxy Upload] Failed to get upload URL:", errorText);
        return res.status(500).json({ error: "Failed to get upload URL from ARCHIDOC" });
      }

      const { uploadURL, objectPath } = await urlResponse.json();
      console.log(`[Proxy Upload] Got upload URL, objectPath: ${objectPath}`);

      const fileBuffer = Buffer.from(fileBase64, "base64");
      console.log(`[Proxy Upload] Uploading ${fileBuffer.length} bytes to storage...`);

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: fileBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("[Proxy Upload] Failed to upload to storage:", uploadResponse.status, errorText);
        return res.status(500).json({ error: "Failed to upload file to storage" });
      }

      console.log(`[Proxy Upload] Upload successful, registering asset...`);

      const registerResponse = await fetch(`${archidocApiUrl}/api/field-observations/${observationId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, objectPath, fileName, mimeType: contentType }),
      });

      if (!registerResponse.ok) {
        const errorText = await registerResponse.text();
        console.error("[Proxy Upload] Failed to register asset:", errorText);
        return res.status(500).json({ error: "Failed to register asset in ARCHIDOC" });
      }

      const assetData = await registerResponse.json();
      console.log(`[Proxy Upload] Asset registered successfully: ${fileName}`);
      
      res.json({ success: true, asset: assetData, objectPath });
    } catch (error) {
      console.error("[Proxy Upload] Exception:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.post("/api/archidoc/register-asset", async (req: Request, res: Response) => {
    try {
      const { observationId, assetType, objectPath, fileName, mimeType } = req.body;
      
      const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
      if (!archidocApiUrl) {
        return res.status(500).json({ error: "ARCHIDOC API URL not configured" });
      }

      const response = await fetch(`${archidocApiUrl}/api/field-observations/${observationId}/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assetType, objectPath, fileName, mimeType }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to register asset:", errorText);
        return res.status(response.status).json({ error: "Failed to register asset in ARCHIDOC" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error registering asset:", error);
      res.status(500).json({ error: "Failed to register asset" });
    }
  });

  app.post("/api/sync-observation/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const observation = await storage.getObservation(id);
      if (!observation) {
        return res.status(404).json({ error: "Observation not found" });
      }

      const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
      if (!archidocApiUrl) {
        return res.status(500).json({ error: "ARCHIDOC API URL not configured" });
      }

      if (!observation.archidocProjectId) {
        return res.status(400).json({ error: "No ARCHIDOC project ID associated with this observation" });
      }

      const archidocPayload = {
        projectId: observation.archidocProjectId,
        observedBy: "OUVRO Field User",
        summary: observation.title + (observation.description ? `: ${observation.description}` : ""),
        observedAt: observation.createdAt?.toISOString() || new Date().toISOString(),
        classification: "general",
        status: "pending",
        priority: "normal",
        transcription: observation.transcription || undefined,
        translatedText: observation.translatedText || undefined,
      };

      console.log("[Sync] Observation from DB:", JSON.stringify({
        id: observation.id,
        title: observation.title,
        transcription: observation.transcription,
        translatedText: observation.translatedText,
      }));
      console.log("[Sync] Payload to ARCHIDOC:", JSON.stringify(archidocPayload));

      let archidocObservationId: number | null = null;

      try {
        const archidocResponse = await fetch(`${archidocApiUrl}/api/field-observations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(archidocPayload),
        });

        if (!archidocResponse.ok) {
          const errorText = await archidocResponse.text();
          console.error("ARCHIDOC sync failed:", errorText);
          return res.status(500).json({ error: "Failed to create observation in ARCHIDOC" });
        }
        
        const archidocResult = await archidocResponse.json();
        archidocObservationId = archidocResult.id;
        console.log("Successfully created observation in ARCHIDOC, ID:", archidocObservationId);
      } catch (fetchError) {
        console.error("ARCHIDOC API unreachable:", fetchError);
        return res.status(500).json({ error: "ARCHIDOC API unreachable" });
      }

      res.json({ 
        localId: id,
        archidocObservationId,
        observation 
      });
    } catch (error) {
      console.error("Error syncing observation:", error);
      res.status(500).json({ error: "Failed to sync observation" });
    }
  });

  app.post("/api/mark-synced/:id", async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
