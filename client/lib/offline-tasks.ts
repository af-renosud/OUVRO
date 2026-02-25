import * as FileSystem from "expo-file-system/legacy";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
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
  private isSyncing = false;
  private autoRetryTimer: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  private static AUTO_RETRY_INTERVAL = 120000;
  private static MAX_AUTO_RETRIES = 20;

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

      this.startNetworkListener();
      this.startAutoRetryTimer();

      const netState = await NetInfo.fetch();
      if (netState.isConnected && this.getAcceptedCount() > 0) {
        if (__DEV__) console.log("[OfflineTasks] Network available on init, syncing accepted tasks");
        this.syncAllPending().catch(() => {});
      }
    } catch (error) {
      console.error("[OfflineTasks] Initialization error:", error);
    }
  }

  private startNetworkListener(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && this.getAcceptedCount() > 0 && !this.isSyncing) {
        if (__DEV__) console.log("[OfflineTasks] Network reconnected, auto-syncing tasks");
        this.syncAllPending().catch(() => {});
      }
    });
  }

  private startAutoRetryTimer(): void {
    this.autoRetryTimer = setInterval(() => {
      if (this.getAcceptedCount() > 0 && !this.isSyncing) {
        const retriable = Array.from(this.tasks.values()).filter(
          (t) => t.syncState === "accepted" && t.retryCount < OfflineTaskService.MAX_AUTO_RETRIES
        );
        if (retriable.length > 0) {
          if (__DEV__) console.log("[OfflineTasks] Auto-retry:", retriable.length, "tasks");
          this.syncAllPending().catch(() => {});
        }
      }
    }, OfflineTaskService.AUTO_RETRY_INTERVAL);
  }

  destroy(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.autoRetryTimer) {
      clearInterval(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
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

      const transcriptionText = task.editedTranscription || task.transcription || "";

      let audioBase64: string | undefined;
      if (!transcriptionText && task.audioUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(task.audioUri);
          if (!fileInfo.exists) {
            console.warn("[OfflineTasks] Audio file not found:", task.audioUri);
          } else {
            const fileSizeBytes = "size" in fileInfo ? fileInfo.size : 0;
            const fileSizeMB = fileSizeBytes / (1024 * 1024);
            if (fileSizeMB > 10) {
              console.warn(`[OfflineTasks] Audio file is large (${fileSizeMB.toFixed(1)}MB), reading may use significant memory`);
            }
            audioBase64 = await FileSystem.readAsStringAsync(task.audioUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (__DEV__) console.log("[OfflineTasks] Read audio base64 for task:", localId, "size:", audioBase64.length);
          }
        } catch (e: any) {
          console.warn("[OfflineTasks] Failed to read audio file for base64:", e?.message || e);
        }
      }

      const payload: TaskSyncPayload = {
        localId: task.localId,
        projectId: task.projectId,
        projectName: task.projectName,
        transcription: transcriptionText || undefined,
        audioBase64,
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
    if (this.isSyncing) {
      if (__DEV__) console.log("[OfflineTasks] syncAllPending: already syncing, skipping");
      return;
    }

    const acceptedTasks = Array.from(this.tasks.values()).filter(
      (t) => t.syncState === "accepted"
    );

    if (acceptedTasks.length === 0) return;

    this.isSyncing = true;
    this.emit("stateChanged");
    if (__DEV__) console.log("[OfflineTasks] syncAllPending:", acceptedTasks.length, "tasks");

    try {
      for (const task of acceptedTasks) {
        await this.syncTask(task.localId);
      }
    } finally {
      this.isSyncing = false;
      this.emit("stateChanged");
    }
  }
}

export const offlineTaskService = new OfflineTaskService();
