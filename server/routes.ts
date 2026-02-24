import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { projectsRouter } from "./routes/projects";
import { observationsRouter } from "./routes/observations";
import { aiRouter } from "./routes/ai";
import { archidocRouter } from "./routes/archidoc";
import { syncRouter } from "./routes/sync";

export async function registerRoutes(app: Express): Promise<Server> {
  registerChatRoutes(app);
  registerImageRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.use("/api", projectsRouter);
  app.use("/api", observationsRouter);
  app.use("/api", aiRouter);
  app.use("/api", archidocRouter);
  app.use("/api", syncRouter);

  const httpServer = createServer(app);
  return httpServer;
}
