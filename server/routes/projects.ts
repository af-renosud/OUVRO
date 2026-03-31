import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

export const projectsRouter = Router();

projectsRouter.get("/projects", async (req: Request, res: Response) => {
  try {
    const projects = await storage.getProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

projectsRouter.get("/projects/:id", async (req: Request, res: Response) => {
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

projectsRouter.get("/projects/:id/files", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const files = await storage.getProjectFiles(projectId);
    res.json(files);
  } catch (error) {
    console.error("Error fetching project files:", error);
    res.status(500).json({ error: "Failed to fetch project files" });
  }
});
