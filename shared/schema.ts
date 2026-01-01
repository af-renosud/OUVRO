import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  status: text("status").default("active"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  observations: many(observations),
  projectFiles: many(projectFiles),
}));

export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  transcription: text("transcription"),
  translatedText: text("translated_text"),
  syncStatus: text("sync_status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  syncedAt: timestamp("synced_at"),
});

export const observationsRelations = relations(observations, ({ one, many }) => ({
  project: one(projects, {
    fields: [observations.projectId],
    references: [projects.id],
  }),
  media: many(observationMedia),
}));

export const observationMedia = pgTable("observation_media", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id").notNull().references(() => observations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  localUri: text("local_uri"),
  remoteUrl: text("remote_url"),
  thumbnailUri: text("thumbnail_uri"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const observationMediaRelations = relations(observationMedia, ({ one }) => ({
  observation: one(observations, {
    fields: [observationMedia.observationId],
    references: [observations.id],
  }),
}));

export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  remoteUrl: text("remote_url"),
  localUri: text("local_uri"),
  fileSize: integer("file_size"),
  isDownloaded: boolean("is_downloaded").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertObservationSchema = createInsertSchema(observations).omit({ id: true, createdAt: true, syncedAt: true });
export const insertObservationMediaSchema = createInsertSchema(observationMedia).omit({ id: true, createdAt: true });
export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({ id: true, createdAt: true });

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Observation = typeof observations.$inferSelect;
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type ObservationMedia = typeof observationMedia.$inferSelect;
export type InsertObservationMedia = z.infer<typeof insertObservationMediaSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
