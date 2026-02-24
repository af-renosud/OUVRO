import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertProjectSchema, insertProjectFileSchema } from "@shared/schema";

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

projectsRouter.post("/projects", async (req: Request, res: Response) => {
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

projectsRouter.post("/projects/:id/files", async (req: Request, res: Response) => {
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
