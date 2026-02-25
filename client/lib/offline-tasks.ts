import * as FileSystem from "expo-file-system/legacy";
import { DurableQueueStore } from "./durable-queue-store";
import { getApiUrl } from "./query-client";
import type { TaskPriority, TaskClassification, TaskSyncPayload, TaskSyncSuccessResponse, TaskSyncErrorResponse } from "../../shared/task-sync-types";

export type TaskSyncState =
  | "pending"
  | "transcribing"
  | "review"
  | "accepted"
  | "uploading"
  | "complete"
  | "failed";

export interface OfflineTask {
  localId: string;
  projectId: string;
  projectName: string;
  audioUri: string;
  audioFileName: string;
  audioDuration: number;
  audioFileSize?: number;
  transcription?: string;
  editedTranscription?: string;
  priority: TaskPriority;
  classification: TaskClassification;
  recordedAt: string;
  recordedBy: string;
  syncState: TaskSyncState;
  remoteTaskId?: string;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  syncCompletedAt?: string;
  retryCount: number;
}

type TaskEventType =
  | "stateChanged"
  | "taskAdded"
  | "taskUpdated"
  | "taskSynced"
  | "taskFailed";

type TaskEventListener = (event: TaskEventType, data?: any) => void;

class OfflineTaskService {
  private tasks: Map<string, OfflineTask> = new Map();
  private store = new DurableQueueStore<OfflineTask>(
    "ouvro_pending_tasks",
    "ouvro_tasks",
    "OfflineTasks"
  );
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const parsed = await this.store.load();
      parsed.forEach((task) => {
        if (task.syncState === "uploading") {
          task.syncState = "accepted";
          task.lastSyncError = "Upload interrupted - will retry";
        }
        if (task.syncState === "transcribing") {
          task.syncState = "pending";
          task.lastSyncError = "Transcription interrupted - will retry";
        }
        this.tasks.set(task.localId, task);
      });
      this.isInitialized = true;
      if (__DEV__) console.log("[OfflineTasks] Initialized with", this.tasks.size, "tasks");
    } catch (error) {
      console.error("[OfflineTasks] Initialization error:", error);
    }
  }

  subscribe(listener: TaskEventListener): () => void {
    return this.store.subscribe(listener as (event: string, data?: any) => void);
  }

  private emit(event: TaskEventType, data?: any): void {
    this.store.emit(event, data);
  }

  private async persist(): Promise<void> {
    await this.store.save(Array.from(this.tasks.values()));
  }

  async addTask(params: {
    projectId: string;
    projectName: string;
    audioUri: string;
    audioDuration: number;
    priority?: TaskPriority;
    classification?: TaskClassification;
    recordedAt?: string;
    recordedBy?: string;
  }): Promise<string> {
    const localId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const fileName = params.audioUri.split("/").pop() || `task_${Date.now()}.m4a`;
    const durableUri = await this.store.copyToDurableStorage(params.audioUri, fileName);

    let audioFileSize: number | undefined;
    try {
      const fileInfo = await FileSystem.getInfoAsync(durableUri);
      if (fileInfo.exists && "size" in fileInfo) {
        audioFileSize = (fileInfo as any).size;
      }
    } catch (e) {
      if (__DEV__) console.warn("[OfflineTasks] Could not get file size:", e);
    }

    const task: OfflineTask = {
      localId,
      projectId: params.projectId,
      projectName: params.projectName,
      audioUri: durableUri,
      audioFileName: fileName,
      audioDuration: params.audioDuration,
      audioFileSize,
      priority: params.priority || "normal",
      classification: params.classification || "general",
      recordedAt: params.recordedAt || now,
      recordedBy: params.recordedBy || "OUVRO Field User",
      syncState: "pending",
      createdAt: now,
      modifiedAt: now,
      retryCount: 0,
    };

    this.tasks.set(localId, task);
    await this.persist();
    this.emit("taskAdded", { localId });
    this.emit("stateChanged");

    if (__DEV__) console.log("[OfflineTasks] Added task:", localId, "audio saved at:", durableUri);

    return localId;
  }

  async updateTask(localId: string, updates: Partial<Pick<OfflineTask, "transcription" | "editedTranscription" | "syncState">>): Promise<void> {
    const task = this.tasks.get(localId);
    if (!task) return;

    Object.assign(task, updates);
    task.modifiedAt = new Date().toISOString();

    await this.persist();
    this.emit("taskUpdated", { localId });
    this.emit("stateChanged");
  }

  async acceptTask(localId: string, finalTranscription: string, options?: { priority?: TaskPriority; classification?: TaskClassification }): Promise<void> {
    const task = this.tasks.get(localId);
    if (!task) return;

    task.editedTranscription = finalTranscription;
    if (options?.priority) task.priority = options.priority;
    if (options?.classification) task.classification = options.classification;
    task.syncState = "accepted";
    task.modifiedAt = new Date().toISOString();

    await this.persist();
    this.emit("taskUpdated", { localId });
    this.emit("stateChanged");

    if (__DEV__) console.log("[OfflineTasks] Task accepted:", localId);
  }

  async removeTask(localId: string): Promise<void> {
    const task = this.tasks.get(localId);
    if (task) {
      await this.store.deleteFile(task.audioUri);
    }

    this.tasks.delete(localId);
    await this.persist();
    this.emit("stateChanged");
  }

  async retryTask(localId: string): Promise<void> {
    const task = this.tasks.get(localId);
    if (!task) return;

    if (task.editedTranscription || task.transcription) {
      task.syncState = "accepted";
    } else {
      task.syncState = "pending";
    }
    task.retryCount = 0;
    task.lastSyncError = undefined;

    await this.persist();
    this.emit("stateChanged");
  }

  async clearCompleted(): Promise<void> {
    const completedIds: string[] = [];
    this.tasks.forEach((task, id) => {
      if (task.syncState === "complete") {
        completedIds.push(id);
      }
    });

    for (const id of completedIds) {
      const task = this.tasks.get(id);
      if (task) {
        await this.store.deleteFile(task.audioUri);
      }
      this.tasks.delete(id);
    }

    await this.persist();
    this.emit("stateChanged");
  }

  getTasks(): OfflineTask[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getTask(localId: string): OfflineTask | undefined {
    return this.tasks.get(localId);
  }

  getPendingCount(): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.syncState !== "complete"
    ).length;
  }

  getAcceptedCount(): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.syncState === "accepted"
    ).length;
  }

  async syncTask(localId: string): Promise<void> {
    const task = this.tasks.get(localId);
    if (!task) return;

    if (task.syncState !== "accepted") {
      if (__DEV__) console.warn("[OfflineTasks] syncTask: task not in accepted state:", localId, task.syncState);
      return;
    }

    task.syncState = "uploading";
    task.lastSyncAttempt = new Date().toISOString();
    task.modifiedAt = new Date().toISOString();
    await this.persist();
    this.emit("taskUpdated", { localId });
    this.emit("stateChanged");

    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/tasks/sync", baseUrl);

      const payload: TaskSyncPayload = {
        localId: task.localId,
        projectId: task.projectId,
        projectName: task.projectName,
        transcription: task.editedTranscription || task.transcription || "",
        priority: task.priority,
        classification: task.classification,
        audioDuration: task.audioDuration,
        recordedAt: task.recordedAt,
        recordedBy: task.recordedBy,
      };

      const res = await fetch(url.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        const data = (await res.json()) as TaskSyncSuccessResponse;
        task.syncState = "complete";
        task.remoteTaskId = data.archidocTaskId;
        task.syncCompletedAt = new Date().toISOString();
        task.modifiedAt = new Date().toISOString();
        await this.persist();
        this.emit("taskSynced", { localId });
        this.emit("stateChanged");
        if (__DEV__) console.log("[OfflineTasks] Task synced:", localId, "remoteId:", data.archidocTaskId);
      } else if (res.status === 400) {
        const data = (await res.json()) as TaskSyncErrorResponse;
        task.syncState = "failed";
        task.lastSyncError = data.error || "Bad request - data invalid";
        task.modifiedAt = new Date().toISOString();
        await this.persist();
        this.emit("taskFailed", { localId, error: task.lastSyncError });
        this.emit("stateChanged");
        if (__DEV__) console.warn("[OfflineTasks] Task failed (400):", localId, data.error);
      } else {
        let errorMsg = `Server error (${res.status})`;
        try {
          const data = (await res.json()) as TaskSyncErrorResponse;
          errorMsg = data.error || errorMsg;
        } catch {}
        task.syncState = "accepted";
        task.retryCount += 1;
        task.lastSyncError = errorMsg;
        task.modifiedAt = new Date().toISOString();
        await this.persist();
        this.emit("taskUpdated", { localId });
        this.emit("stateChanged");
        if (__DEV__) console.warn("[OfflineTasks] Task sync retry:", localId, errorMsg);
      }
    } catch (error: any) {
      task.syncState = "accepted";
      task.retryCount += 1;
      task.lastSyncError = error?.message || "Network error";
      task.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("taskUpdated", { localId });
      this.emit("stateChanged");
      if (__DEV__) console.warn("[OfflineTasks] Task sync network error:", localId, error);
    }
  }

  async syncAllPending(): Promise<void> {
    const acceptedTasks = Array.from(this.tasks.values()).filter(
      (t) => t.syncState === "accepted"
    );

    if (__DEV__) console.log("[OfflineTasks] syncAllPending:", acceptedTasks.length, "tasks");

    for (const task of acceptedTasks) {
      await this.syncTask(task.localId);
    }
  }
}

export const offlineTaskService = new OfflineTaskService();
