import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Observation,
  type InsertObservation,
  type ObservationMedia,
  type InsertObservationMedia,
  type ProjectFile,
  type InsertProjectFile,
  users,
  projects,
  observations,
  observationMedia,
  projectFiles,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
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
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  updateProjectFile(id: number, file: Partial<InsertProjectFile>): Promise<ProjectFile | undefined>;
  deleteProjectFile(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
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

  async createProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }

  async updateProjectFile(id: number, file: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    const [updated] = await db.update(projectFiles).set(file).where(eq(projectFiles.id, id)).returning();
    return updated || undefined;
  }

  async deleteProjectFile(id: number): Promise<void> {
    await db.delete(projectFiles).where(eq(projectFiles.id, id));
  }
}

export const storage = new DatabaseStorage();
