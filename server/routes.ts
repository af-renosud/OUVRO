import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { aiRouter } from "./routes/ai";
import { archidocRouter } from "./routes/archidoc";
import { syncRouter } from "./routes/sync";
import { dqeRouter } from "./routes/dqe";
import { snagsRouter } from "./routes/snags";
import { siteRemindersRouter } from "./routes/site-reminders";
import { uploadsRouter } from "./routes/uploads";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.use("/api", aiRouter);
  app.use("/api", archidocRouter);
  app.use("/api", syncRouter);
  app.use("/api", dqeRouter);
  app.use("/api", snagsRouter);
  app.use("/api", siteRemindersRouter);
  app.use("/api", uploadsRouter);

  const httpServer = createServer(app);
  return httpServer;
}
