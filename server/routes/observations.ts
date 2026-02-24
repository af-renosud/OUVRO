import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertObservationSchema, insertObservationMediaSchema } from "@shared/schema";

export const observationsRouter = Router();

observationsRouter.get("/observations", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const observations = await storage.getObservations(projectId);
    res.json(observations);
  } catch (error) {
    console.error("Error fetching observations:", error);
    res.status(500).json({ error: "Failed to fetch observations" });
  }
});

observationsRouter.get("/observations/pending", async (req: Request, res: Response) => {
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

observationsRouter.get("/observations/:id", async (req: Request, res: Response) => {
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

observationsRouter.post("/observations", async (req: Request, res: Response) => {
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

observationsRouter.patch("/observations/:id", async (req: Request, res: Response) => {
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

observationsRouter.delete("/observations/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getObservation(id);
    if (!existing) {
      return res.status(204).send();
    }
    await storage.deleteObservation(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting observation:", error);
    res.status(500).json({ error: "Failed to delete observation" });
  }
});

observationsRouter.post("/observations/:id/media", async (req: Request, res: Response) => {
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
