import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertObservationSchema, insertObservationMediaSchema } from "@shared/schema";
import { formatServerError } from "./archidoc-helpers";

export const observationsRouter = Router();

observationsRouter.get("/observations", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const observations = await storage.getObservations(projectId);
    return res.json(observations);
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Observations");
    return res.status(status).json({ error: message });
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
    return res.json(observationsWithMedia);
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Pending Observations");
    return res.status(status).json({ error: message });
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
    return res.json({ ...observation, media });
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Observation");
    return res.status(status).json({ error: message });
  }
});

observationsRouter.post("/observations", async (req: Request, res: Response) => {
  try {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const observation = await storage.createObservation(parsed.data);
    return res.status(201).json(observation);
  } catch (error) {
    const { status, message } = formatServerError(error, "Create Observation");
    return res.status(status).json({ error: message });
  }
});

observationsRouter.patch("/observations/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const observation = await storage.updateObservation(id, req.body);
    if (!observation) {
      return res.status(404).json({ error: "Observation not found" });
    }
    return res.json(observation);
  } catch (error) {
    const { status, message } = formatServerError(error, "Update Observation");
    return res.status(status).json({ error: message });
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
    return res.status(204).send();
  } catch (error) {
    const { status, message } = formatServerError(error, "Delete Observation");
    return res.status(status).json({ error: message });
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
    return res.status(201).json(media);
  } catch (error) {
    const { status, message } = formatServerError(error, "Create Observation Media");
    return res.status(status).json({ error: message });
  }
});
