var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/replit_integrations/chat/routes.ts
import { GoogleGenAI } from "@google/genai";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  conversations: () => conversations,
  insertConversationSchema: () => insertConversationSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertObservationMediaSchema: () => insertObservationMediaSchema,
  insertObservationSchema: () => insertObservationSchema,
  insertProjectFileSchema: () => insertProjectFileSchema,
  insertProjectSchema: () => insertProjectSchema,
  insertUserSchema: () => insertUserSchema,
  messages: () => messages,
  observationMedia: () => observationMedia,
  observationMediaRelations: () => observationMediaRelations,
  observations: () => observations,
  observationsRelations: () => observationsRelations,
  projectFiles: () => projectFiles,
  projectFilesRelations: () => projectFilesRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  users: () => users
});
import { sql as sql2, relations } from "drizzle-orm";
import { pgTable as pgTable2, text as text2, varchar, serial as serial2, integer as integer2, timestamp as timestamp2, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema2 } from "drizzle-zod";

// shared/models/chat.ts
import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
var conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});

// shared/schema.ts
var users = pgTable2("users", {
  id: varchar("id").primaryKey().default(sql2`gen_random_uuid()`),
  username: text2("username").notNull().unique(),
  password: text2("password").notNull()
});
var insertUserSchema = createInsertSchema2(users).pick({
  username: true,
  password: true
});
var projects = pgTable2("projects", {
  id: serial2("id").primaryKey(),
  name: text2("name").notNull(),
  location: text2("location"),
  status: text2("status").default("active"),
  thumbnailUrl: text2("thumbnail_url"),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp2("updated_at").default(sql2`CURRENT_TIMESTAMP`).notNull()
});
var projectsRelations = relations(projects, ({ many }) => ({
  observations: many(observations),
  projectFiles: many(projectFiles)
}));
var observations = pgTable2("observations", {
  id: serial2("id").primaryKey(),
  projectId: integer2("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text2("title").notNull(),
  description: text2("description"),
  transcription: text2("transcription"),
  translatedText: text2("translated_text"),
  syncStatus: text2("sync_status").default("pending"),
  archidocProjectId: text2("archidoc_project_id"),
  projectName: text2("project_name"),
  contractorName: text2("contractor_name"),
  contractorEmail: text2("contractor_email"),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull(),
  syncedAt: timestamp2("synced_at")
});
var observationsRelations = relations(observations, ({ one, many }) => ({
  project: one(projects, {
    fields: [observations.projectId],
    references: [projects.id]
  }),
  media: many(observationMedia)
}));
var observationMedia = pgTable2("observation_media", {
  id: serial2("id").primaryKey(),
  observationId: integer2("observation_id").notNull().references(() => observations.id, { onDelete: "cascade" }),
  type: text2("type").notNull(),
  localUri: text2("local_uri"),
  remoteUrl: text2("remote_url"),
  thumbnailUri: text2("thumbnail_uri"),
  duration: integer2("duration"),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull()
});
var observationMediaRelations = relations(observationMedia, ({ one }) => ({
  observation: one(observations, {
    fields: [observationMedia.observationId],
    references: [observations.id]
  })
}));
var projectFiles = pgTable2("project_files", {
  id: serial2("id").primaryKey(),
  projectId: integer2("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text2("name").notNull(),
  type: text2("type").notNull(),
  remoteUrl: text2("remote_url"),
  localUri: text2("local_uri"),
  fileSize: integer2("file_size"),
  isDownloaded: boolean("is_downloaded").default(false),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull()
});
var projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id]
  })
}));
var insertProjectSchema = createInsertSchema2(projects).omit({ id: true, createdAt: true, updatedAt: true });
var insertObservationSchema = createInsertSchema2(observations).omit({ id: true, createdAt: true, syncedAt: true });
var insertObservationMediaSchema = createInsertSchema2(observationMedia).omit({ id: true, createdAt: true });
var insertProjectFileSchema = createInsertSchema2(projectFiles).omit({ id: true, createdAt: true });

// server/db.ts
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/replit_integrations/chat/storage.ts
import { eq, desc } from "drizzle-orm";
var chatStorage = {
  async getConversation(id) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },
  async getAllConversations() {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },
  async createConversation(title) {
    const [conversation] = await db.insert(conversations).values({ title }).returning();
    return conversation;
  },
  async deleteConversation(id) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },
  async getMessagesByConversation(conversationId) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },
  async createMessage(conversationId, role, content) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  }
};

// server/replit_integrations/chat/routes.ts
var ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
  }
});
function registerChatRoutes(app2) {
  app2.get("/api/conversations", async (req, res) => {
    try {
      const conversations2 = await chatStorage.getAllConversations();
      res.json(conversations2);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app2.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages2 = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: messages2 });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  app2.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  app2.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;
      await chatStorage.createMessage(conversationId, "user", content);
      const messages2 = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages2.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: chatMessages
      });
      let fullResponse = "";
      for await (const chunk of stream) {
        const content2 = chunk.text || "";
        if (content2) {
          fullResponse += content2;
          res.write(`data: ${JSON.stringify({ content: content2 })}

`);
        }
      }
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}

`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

// server/replit_integrations/image/routes.ts
import { Modality as Modality2 } from "@google/genai";

// server/replit_integrations/image/client.ts
import { GoogleGenAI as GoogleGenAI2, Modality } from "@google/genai";
var ai2 = new GoogleGenAI2({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
  }
});

// server/replit_integrations/image/routes.ts
function registerImageRoutes(app2) {
  app2.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const response = await ai2.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality2.TEXT, Modality2.IMAGE]
        }
      });
      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part) => part.inlineData);
      if (!imagePart?.inlineData?.data) {
        return res.status(500).json({ error: "No image data in response" });
      }
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      res.json({
        b64_json: imagePart.inlineData.data,
        mimeType
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}

// server/routes/projects.ts
import { Router } from "express";

// server/storage.ts
import { eq as eq2, desc as desc2 } from "drizzle-orm";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq2(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq2(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getProjects() {
    return db.select().from(projects).orderBy(desc2(projects.updatedAt));
  }
  async getProject(id) {
    const [project] = await db.select().from(projects).where(eq2(projects.id, id));
    return project || void 0;
  }
  async createProject(project) {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }
  async updateProject(id, project) {
    const [updated] = await db.update(projects).set(project).where(eq2(projects.id, id)).returning();
    return updated || void 0;
  }
  async deleteProject(id) {
    await db.delete(projects).where(eq2(projects.id, id));
  }
  async getObservations(projectId) {
    if (projectId) {
      return db.select().from(observations).where(eq2(observations.projectId, projectId)).orderBy(desc2(observations.createdAt));
    }
    return db.select().from(observations).orderBy(desc2(observations.createdAt));
  }
  async getObservation(id) {
    const [observation] = await db.select().from(observations).where(eq2(observations.id, id));
    return observation || void 0;
  }
  async createObservation(observation) {
    const [newObservation] = await db.insert(observations).values(observation).returning();
    return newObservation;
  }
  async updateObservation(id, observation) {
    const [updated] = await db.update(observations).set(observation).where(eq2(observations.id, id)).returning();
    return updated || void 0;
  }
  async deleteObservation(id) {
    await db.delete(observations).where(eq2(observations.id, id));
  }
  async getPendingObservations() {
    return db.select().from(observations).where(eq2(observations.syncStatus, "pending")).orderBy(desc2(observations.createdAt));
  }
  async getObservationMedia(observationId) {
    return db.select().from(observationMedia).where(eq2(observationMedia.observationId, observationId));
  }
  async createObservationMedia(media) {
    const [newMedia] = await db.insert(observationMedia).values(media).returning();
    return newMedia;
  }
  async deleteObservationMedia(id) {
    await db.delete(observationMedia).where(eq2(observationMedia.id, id));
  }
  async getProjectFiles(projectId) {
    return db.select().from(projectFiles).where(eq2(projectFiles.projectId, projectId)).orderBy(desc2(projectFiles.createdAt));
  }
  async getProjectFile(id) {
    const [file] = await db.select().from(projectFiles).where(eq2(projectFiles.id, id));
    return file || void 0;
  }
  async createProjectFile(file) {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }
  async updateProjectFile(id, file) {
    const [updated] = await db.update(projectFiles).set(file).where(eq2(projectFiles.id, id)).returning();
    return updated || void 0;
  }
  async deleteProjectFile(id) {
    await db.delete(projectFiles).where(eq2(projectFiles.id, id));
  }
};
var storage = new DatabaseStorage();

// server/routes/projects.ts
var projectsRouter = Router();
projectsRouter.get("/projects", async (req, res) => {
  try {
    const projects2 = await storage.getProjects();
    res.json(projects2);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});
projectsRouter.get("/projects/:id", async (req, res) => {
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
projectsRouter.post("/projects", async (req, res) => {
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
projectsRouter.get("/projects/:id/files", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const files = await storage.getProjectFiles(projectId);
    res.json(files);
  } catch (error) {
    console.error("Error fetching project files:", error);
    res.status(500).json({ error: "Failed to fetch project files" });
  }
});
projectsRouter.post("/projects/:id/files", async (req, res) => {
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

// server/routes/observations.ts
import { Router as Router2 } from "express";
var observationsRouter = Router2();
observationsRouter.get("/observations", async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId) : void 0;
    const observations2 = await storage.getObservations(projectId);
    res.json(observations2);
  } catch (error) {
    console.error("Error fetching observations:", error);
    res.status(500).json({ error: "Failed to fetch observations" });
  }
});
observationsRouter.get("/observations/pending", async (req, res) => {
  try {
    const observations2 = await storage.getPendingObservations();
    const observationsWithMedia = await Promise.all(
      observations2.map(async (obs) => {
        const media = await storage.getObservationMedia(obs.id);
        const project = await storage.getProject(obs.projectId);
        return {
          ...obs,
          media,
          projectName: obs.projectName || project?.name || "Unknown Project"
        };
      })
    );
    res.json(observationsWithMedia);
  } catch (error) {
    console.error("Error fetching pending observations:", error);
    res.status(500).json({ error: "Failed to fetch pending observations" });
  }
});
observationsRouter.get("/observations/:id", async (req, res) => {
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
observationsRouter.post("/observations", async (req, res) => {
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
observationsRouter.patch("/observations/:id", async (req, res) => {
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
observationsRouter.delete("/observations/:id", async (req, res) => {
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
observationsRouter.post("/observations/:id/media", async (req, res) => {
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

// server/routes/ai.ts
import { Router as Router3 } from "express";
import { GoogleGenAI as GoogleGenAI3 } from "@google/genai";
var ai3 = new GoogleGenAI3({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
  }
});
var aiRouter = Router3();
aiRouter.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/mp4" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Audio data is required" });
    }
    const response = await ai3.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else." },
            {
              inlineData: {
                mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ]
    });
    const transcription = response.text || "";
    res.json({ transcription });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    const errorMessage = error?.message || "Failed to transcribe audio";
    res.status(500).json({ error: errorMessage });
  }
});
aiRouter.post("/translate", async (req, res) => {
  try {
    const { text: text3, targetLanguage = "French" } = req.body;
    if (!text3) {
      return res.status(400).json({ error: "Text is required" });
    }
    const response = await ai3.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Translate the following text to ${targetLanguage}. Only output the translation, nothing else:

${text3}` }
          ]
        }
      ]
    });
    const translation = response.text || "";
    res.json({ translation });
  } catch (error) {
    console.error("Error translating text:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
});

// server/routes/archidoc.ts
import { Router as Router4 } from "express";

// server/routes/archidoc-helpers.ts
var ARCHIDOC_TIMEOUT_MS = 15e3;
var ARCHIDOC_UPLOAD_TIMEOUT_MS = 6e4;
function archidocFetch(url, options = {}) {
  const timeoutMs = options.timeout || ARCHIDOC_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal
  }).then((response) => {
    clearTimeout(timeoutId);
    return response;
  }).catch((error) => {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`ARCHIDOC request timed out after ${timeoutMs / 1e3}s: ${url}`);
    }
    throw error;
  });
}
function isTimeoutError(error) {
  return error instanceof Error && (error.message.includes("timed out") || error.name === "AbortError");
}
function formatServerError(error, context) {
  if (isTimeoutError(error)) {
    console.error(`[${context}] Timeout:`, error);
    return { status: 504, message: `ARCHIDOC server took too long to respond. Please retry.` };
  }
  if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("network"))) {
    console.error(`[${context}] Network error:`, error);
    return { status: 503, message: `Cannot reach ARCHIDOC server. Please retry shortly.` };
  }
  console.error(`[${context}] Error:`, error);
  return { status: 500, message: `${context} failed. Please retry.` };
}
function requireArchidocUrl(req, res, next) {
  const archidocApiUrl = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;
  if (!archidocApiUrl) {
    return res.status(500).json({ error: "ARCHIDOC API URL not configured" });
  }
  res.locals.archidocApiUrl = archidocApiUrl;
  next();
}
async function archidocJsonPost(url, body, context, timeout) {
  const response = await archidocFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${context}] ARCHIDOC error:`, errorText);
    return { error: `Failed to ${context.toLowerCase()}`, status: response.status };
  }
  const data = await response.json();
  return { data };
}
function buildArchidocObservationPayload(fields) {
  return {
    projectId: fields.projectId,
    observedBy: fields.observedBy || "OUVRO Field User",
    summary: fields.title + (fields.description ? `: ${fields.description}` : ""),
    observedAt: fields.observedAt || (/* @__PURE__ */ new Date()).toISOString(),
    classification: "general",
    status: "pending",
    priority: "normal",
    transcription: fields.transcription || void 0,
    translatedText: fields.translatedText || void 0
  };
}

// server/routes/archidoc.ts
var archidocRouter = Router4();
archidocRouter.use(requireArchidocUrl);
archidocRouter.post("/archidoc/upload-url", async (req, res) => {
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
archidocRouter.post("/archidoc/proxy-upload", async (req, res) => {
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
      timeout: ARCHIDOC_UPLOAD_TIMEOUT_MS
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
archidocRouter.post("/archidoc/register-asset", async (req, res) => {
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
archidocRouter.post("/archidoc/create-observation", async (req, res) => {
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
      translatedText
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

// server/routes/sync.ts
import { Router as Router5 } from "express";
import { GoogleGenAI as GoogleGenAI4 } from "@google/genai";
var ai4 = new GoogleGenAI4({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
  }
});
async function transcribeWithGemini(audioBase64, mimeType) {
  const response = await ai4.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else." },
          {
            inlineData: {
              mimeType,
              data: audioBase64
            }
          }
        ]
      }
    ]
  });
  return response.text || "";
}
var syncRouter = Router5();
syncRouter.post("/sync-observation/:id", requireArchidocUrl, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const observation = await storage.getObservation(id);
    if (!observation) {
      return res.status(404).json({ error: "Observation not found" });
    }
    const archidocApiUrl = res.locals.archidocApiUrl;
    if (!observation.archidocProjectId) {
      return res.status(400).json({ error: "No ARCHIDOC project ID associated with this observation" });
    }
    const archidocPayload = buildArchidocObservationPayload({
      projectId: observation.archidocProjectId,
      title: observation.title,
      description: observation.description,
      observedAt: observation.createdAt?.toISOString(),
      transcription: observation.transcription,
      translatedText: observation.translatedText
    });
    console.log("[Sync] Observation from DB:", JSON.stringify({
      id: observation.id,
      title: observation.title,
      transcription: observation.transcription,
      translatedText: observation.translatedText
    }));
    console.log("[Sync] Payload to ARCHIDOC:", JSON.stringify(archidocPayload));
    const result = await archidocJsonPost(
      `${archidocApiUrl}/api/field-observations`,
      archidocPayload,
      "Sync observation to ARCHIDOC"
    );
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    console.log("Successfully created observation in ARCHIDOC, ID:", result.data.id);
    res.json({
      localId: id,
      archidocObservationId: result.data.id,
      observation
    });
  } catch (error) {
    const { status, message } = formatServerError(error, "Sync observation");
    res.status(status).json({ error: message });
  }
});
syncRouter.post("/tasks/sync", async (req, res) => {
  try {
    const { projectId, projectName, transcription, audioDuration, localId } = req.body;
    if (!projectId || !transcription) {
      return res.status(400).json({ error: "Missing required fields: projectId, transcription" });
    }
    console.log(`[Task Sync] Received task for project ${projectId} (${projectName}): "${transcription.substring(0, 80)}..."`);
    res.json({
      success: true,
      taskId: `archidoc_task_${Date.now()}`,
      localId,
      message: "Task received. ARCHIDOC endpoint not yet implemented - task stored locally."
    });
  } catch (error) {
    console.error("[Task Sync] Error:", error);
    res.status(500).json({ error: "Failed to sync task" });
  }
});
syncRouter.post("/voice-task", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/mp4", project_id, recorded_by, recorded_at, priority, classification } = req.body;
    if (!audioBase64 || !project_id) {
      return res.status(400).json({ error: "audioBase64 and project_id are required" });
    }
    const archidocApiUrl = process.env.ARCHIDOC_API_URL;
    let archidocResult = null;
    if (archidocApiUrl) {
      try {
        const fileBuffer = Buffer.from(audioBase64, "base64");
        const fileExtension = mimeType === "audio/mpeg" ? "mp3" : "m4a";
        const fileName = `voice-task-${Date.now()}.${fileExtension}`;
        console.log(`[VoiceTask] Uploading ${fileBuffer.length} bytes for project ${project_id}`);
        const boundary = `----FormBoundary${Date.now()}`;
        const parts = [];
        const addField = (name, value) => {
          parts.push(Buffer.from(`--${boundary}\r
Content-Disposition: form-data; name="${name}"\r
\r
${value}\r
`));
        };
        addField("project_id", project_id);
        addField("recorded_by", recorded_by || "OUVRO Field User");
        if (recorded_at) addField("recorded_at", recorded_at);
        if (priority) addField("priority", priority);
        if (classification) addField("classification", classification);
        parts.push(Buffer.from(
          `--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${fileName}"\r
Content-Type: ${mimeType}\r
\r
`
        ));
        parts.push(fileBuffer);
        parts.push(Buffer.from(`\r
--${boundary}--\r
`));
        const body = Buffer.concat(parts);
        const archidocResponse = await archidocFetch(`${archidocApiUrl}/api/ouvro/voice-task`, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(body.length)
          },
          body,
          timeout: ARCHIDOC_UPLOAD_TIMEOUT_MS
        });
        if (archidocResponse.ok) {
          archidocResult = await archidocResponse.json();
          console.log("[VoiceTask] Task created in ArchiDoc:", archidocResult.task_id);
          return res.json(archidocResult);
        }
        const errorText = await archidocResponse.text();
        console.warn(`[VoiceTask] ArchiDoc returned ${archidocResponse.status}, falling back to Gemini transcription`);
      } catch (archidocError) {
        console.warn("[VoiceTask] ArchiDoc unavailable, falling back to Gemini transcription:", archidocError.message);
      }
    } else {
      console.log("[VoiceTask] No ARCHIDOC_API_URL configured, using Gemini transcription");
    }
    console.log("[VoiceTask] Transcribing with Gemini...");
    const transcription = await transcribeWithGemini(audioBase64, mimeType);
    const taskTitle = transcription.length > 80 ? transcription.substring(0, 77) + "..." : transcription;
    console.log("[VoiceTask] Gemini transcription complete:", taskTitle);
    res.json({
      task_id: `local-${Date.now()}`,
      transcription,
      task_title: taskTitle,
      source: "gemini-fallback"
    });
  } catch (error) {
    const { status, message } = formatServerError(error, "Voice Task");
    res.status(status).json({ error: message });
  }
});
syncRouter.post("/mark-synced/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updatedObservation = await storage.updateObservation(id, {
      syncStatus: "synced"
    });
    res.json(updatedObservation);
  } catch (error) {
    console.error("Error marking observation as synced:", error);
    res.status(500).json({ error: "Failed to mark observation as synced" });
  }
});

// server/routes.ts
async function registerRoutes(app2) {
  registerChatRoutes(app2);
  registerImageRoutes(app2);
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString(), uptime: process.uptime() });
  });
  app2.use("/api", projectsRouter);
  app2.use("/api", observationsRouter);
  app2.use("/api", aiRouter);
  app2.use("/api", archidocRouter);
  app2.use("/api", syncRouter);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "100mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "100mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error(`[ErrorHandler] ${status}: ${message}`, err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  app.get("/status", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
