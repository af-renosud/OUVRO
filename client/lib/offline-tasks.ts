import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const STORAGE_KEY = "ouvro_pending_tasks";

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
  private listeners: Set<TaskEventListener> = new Set();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as OfflineTask[];
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
      }
      this.isInitialized = true;
      if (__DEV__) console.log("[OfflineTasks] Initialized with", this.tasks.size, "tasks");
    } catch (error) {
      console.error("[OfflineTasks] Initialization error:", error);
    }
  }

  subscribe(listener: TaskEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: TaskEventType, data?: any): void {
    this.listeners.forEach((listener) => listener(event, data));
  }

  private async persist(): Promise<void> {
    try {
      const arr = Array.from(this.tasks.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (error) {
      console.error("[OfflineTasks] Persist error:", error);
    }
  }

  private async copyToDurableStorage(uri: string, fileName: string): Promise<string> {
    try {
      if (uri.startsWith("mock://") || uri.includes("/ouvro_tasks/")) {
        return uri;
      }

      const durableDir = `${FileSystem.documentDirectory}ouvro_tasks/`;
      const dirInfo = await FileSystem.getInfoAsync(durableDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(durableDir, { intermediates: true });
      }

      const uniqueFileName = `${Date.now()}_${fileName}`;
      const durableUri = `${durableDir}${uniqueFileName}`;

      await FileSystem.copyAsync({ from: uri, to: durableUri });

      if (__DEV__) console.log("[OfflineTasks] Copied audio to durable storage:", durableUri);
      return durableUri;
    } catch (error) {
      console.error("[OfflineTasks] Failed to copy to durable storage:", error);
      return uri;
    }
  }

  async addTask(params: {
    projectId: string;
    projectName: string;
    audioUri: string;
    audioDuration: number;
  }): Promise<string> {
    const localId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const fileName = params.audioUri.split("/").pop() || `task_${Date.now()}.m4a`;
    const durableUri = await this.copyToDurableStorage(params.audioUri, fileName);

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

  async acceptTask(localId: string, finalTranscription: string): Promise<void> {
    const task = this.tasks.get(localId);
    if (!task) return;

    task.editedTranscription = finalTranscription;
    task.syncState = "accepted";
    task.modifiedAt = new Date().toISOString();

    await this.persist();
    this.emit("taskUpdated", { localId });
    this.emit("stateChanged");

    if (__DEV__) console.log("[OfflineTasks] Task accepted:", localId);
  }

  async removeTask(localId: string): Promise<void> {
    const task = this.tasks.get(localId);
    if (task && task.audioUri && !task.audioUri.startsWith("mock://")) {
      try {
        await FileSystem.deleteAsync(task.audioUri, { idempotent: true });
      } catch (e) {
        if (__DEV__) console.warn("[OfflineTasks] Failed to delete audio file:", task.audioUri);
      }
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
      if (task?.audioUri && !task.audioUri.startsWith("mock://")) {
        try {
          await FileSystem.deleteAsync(task.audioUri, { idempotent: true });
        } catch (e) {}
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
}

export const offlineTaskService = new OfflineTaskService();
