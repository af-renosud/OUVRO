import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { aiRouter } from "./routes/ai";
import { archidocRouter } from "./routes/archidoc";
import { syncRouter } from "./routes/sync";
import { dqeRouter } from "./routes/dqe";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.use("/api", aiRouter);
  app.use("/api", archidocRouter);
  app.use("/api", syncRouter);
  app.use("/api", dqeRouter);

  const httpServer = createServer(app);
  return httpServer;
}
