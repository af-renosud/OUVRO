import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { formatServerError } from "./archidoc-helpers";

export const projectsRouter = Router();

projectsRouter.get("/projects", async (req: Request, res: Response) => {
  try {
    const projects = await storage.getProjects();
    return res.json(projects);
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Projects");
    return res.status(status).json({ error: message });
  }
});

projectsRouter.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.json(project);
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Project");
    return res.status(status).json({ error: message });
  }
});

projectsRouter.get("/projects/:id/files", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const files = await storage.getProjectFiles(projectId);
    return res.json(files);
  } catch (error) {
    const { status, message } = formatServerError(error, "Fetch Project Files");
    return res.status(status).json({ error: message });
  }
});
