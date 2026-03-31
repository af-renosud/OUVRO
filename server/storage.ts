import {
  type Project,
  type InsertProject,
  type Observation,
  type InsertObservation,
  type ObservationMedia,
  type InsertObservationMedia,
  type ProjectFile,
  type InsertProjectFile,
  projects,
  observations,
  observationMedia,
  projectFiles,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  getObservations(projectId?: number): Promise<Observation[]>;
  getObservation(id: number): Promise<Observation | undefined>;
  createObservation(observation: InsertObservation): Promise<Observation>;
  updateObservation(id: number, observation: Partial<InsertObservation>): Promise<Observation | undefined>;
  deleteObservation(id: number): Promise<void>;
  getPendingObservations(): Promise<Observation[]>;

  getObservationMedia(observationId: number): Promise<ObservationMedia[]>;
  createObservationMedia(media: InsertObservationMedia): Promise<ObservationMedia>;
  deleteObservationMedia(id: number): Promise<void>;

  getProjectFiles(projectId: number): Promise<ProjectFile[]>;
  getProjectFile(id: number): Promise<ProjectFile | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return updated || undefined;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getObservations(projectId?: number): Promise<Observation[]> {
    if (projectId) {
      return db.select().from(observations).where(eq(observations.projectId, projectId)).orderBy(desc(observations.createdAt));
    }
    return db.select().from(observations).orderBy(desc(observations.createdAt));
  }

  async getObservation(id: number): Promise<Observation | undefined> {
    const [observation] = await db.select().from(observations).where(eq(observations.id, id));
    return observation || undefined;
  }

  async createObservation(observation: InsertObservation): Promise<Observation> {
    const [newObservation] = await db.insert(observations).values(observation).returning();
    return newObservation;
  }

  async updateObservation(id: number, observation: Partial<InsertObservation>): Promise<Observation | undefined> {
    const [updated] = await db.update(observations).set(observation).where(eq(observations.id, id)).returning();
    return updated || undefined;
  }

  async deleteObservation(id: number): Promise<void> {
    await db.delete(observations).where(eq(observations.id, id));
  }

  async getPendingObservations(): Promise<Observation[]> {
    return db.select().from(observations).where(eq(observations.syncStatus, "pending")).orderBy(desc(observations.createdAt));
  }

  async getObservationMedia(observationId: number): Promise<ObservationMedia[]> {
    return db.select().from(observationMedia).where(eq(observationMedia.observationId, observationId));
  }

  async createObservationMedia(media: InsertObservationMedia): Promise<ObservationMedia> {
    const [newMedia] = await db.insert(observationMedia).values(media).returning();
    return newMedia;
  }

  async deleteObservationMedia(id: number): Promise<void> {
    await db.delete(observationMedia).where(eq(observationMedia.id, id));
  }

  async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
    return db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt));
  }

  async getProjectFile(id: number): Promise<ProjectFile | undefined> {
    const [file] = await db.select().from(projectFiles).where(eq(projectFiles.id, id));
    return file || undefined;
  }
}

export const storage = new DatabaseStorage();
