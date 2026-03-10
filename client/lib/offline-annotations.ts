import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { DurableQueueStore } from "./durable-queue-store";
import { requestUploadUrl, archiveUploadedFile } from "./archidoc-api";

export type AnnotationSyncState = "pending" | "uploading" | "complete" | "failed";

export interface OfflineAnnotation {
  localId: string;
  projectId: string;
  projectName: string;
  originalFileName: string;
  localUri: string;
  contentType: string;
  fileSize: number;
  syncState: AnnotationSyncState;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  syncCompletedAt?: string;
  retryCount: number;
}

type AnnotationEventType =
  | "stateChanged"
  | "annotationAdded"
  | "annotationSynced"
  | "annotationFailed";

type AnnotationEventListener = (event: AnnotationEventType, data?: any) => void;

const MAX_RETRIES = 10;
const AUTO_RETRY_INTERVAL = 120_000;
const UPLOAD_TIMEOUT = 60_000;

class OfflineAnnotationService {
  private annotations: Map<string, OfflineAnnotation> = new Map();
  private store: DurableQueueStore<OfflineAnnotation>;
  private initialized = false;
  private isSyncing = false;
  private autoRetryTimer: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  constructor() {
    this.store = new DurableQueueStore<OfflineAnnotation>(
      "ouvro_pending_annotations",
      "annotations-media",
      "OfflineAnnotations"
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const items = await this.store.load();
    for (const item of items) {
      if (item.syncState === "uploading") {
        item.syncState = "pending";
        item.lastSyncError = "Upload interrupted, will retry";
        item.modifiedAt = new Date().toISOString();
        await this.store.save(item);
      }
      this.annotations.set(item.localId, item);
    }
    this.initialized = true;
    this.startNetworkListener();
    this.startAutoRetryTimer();
  }

  private startNetworkListener(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.syncAllPending();
      }
    });
  }

  private startAutoRetryTimer(): void {
    if (this.autoRetryTimer) clearInterval(this.autoRetryTimer);
    this.autoRetryTimer = setInterval(() => {
      this.syncAllPending();
    }, AUTO_RETRY_INTERVAL);
  }

  destroy(): void {
    if (this.netInfoUnsubscribe) this.netInfoUnsubscribe();
    if (this.autoRetryTimer) clearInterval(this.autoRetryTimer);
  }

  getAnnotations(): OfflineAnnotation[] {
    return Array.from(this.annotations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  subscribe(listener: AnnotationEventListener): () => void {
    return this.store.subscribe(listener as (event: string, data?: any) => void);
  }

  private emit(event: AnnotationEventType, data?: any): void {
    this.store.emit(event, data);
  }

  private async persist(): Promise<void> {
    await this.store.save(Array.from(this.annotations.values()));
  }

  async addAnnotation(params: {
    capturedUri: string;
    projectId: string;
    projectName: string;
    originalFileName: string;
  }): Promise<string> {
    const localId = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const fileInfo = await FileSystem.getInfoAsync(params.capturedUri);
    const fileSize = (fileInfo as any).size || 0;

    const durableUri = await this.store.copyToDurableStorage(
      params.capturedUri,
      `annotated-${params.originalFileName.replace(/\.[^/.]+$/, "")}-${Date.now()}.jpg`
    );

    const annotation: OfflineAnnotation = {
      localId,
      projectId: params.projectId,
      projectName: params.projectName,
      originalFileName: params.originalFileName,
      localUri: durableUri,
      contentType: "image/jpeg",
      fileSize,
      syncState: "pending",
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.annotations.set(localId, annotation);
    await this.persist();
    this.emit("annotationAdded", annotation);

    this.syncAnnotation(localId);

    return localId;
  }

  async removeAnnotation(localId: string): Promise<void> {
    const annotation = this.annotations.get(localId);
    if (!annotation) return;
    await this.store.deleteFile(annotation.localUri);
    this.annotations.delete(localId);
    await this.persist();
    this.emit("stateChanged");
  }

  async retryAnnotation(localId: string): Promise<void> {
    const annotation = this.annotations.get(localId);
    if (!annotation || annotation.syncState === "complete") return;
    annotation.syncState = "pending";
    annotation.retryCount = 0;
    annotation.lastSyncError = undefined;
    annotation.modifiedAt = new Date().toISOString();
    await this.persist();
    this.emit("stateChanged");
    this.syncAnnotation(localId);
  }

  async clearCompleted(): Promise<void> {
    const toDelete: string[] = [];
    this.annotations.forEach((ann, id) => {
      if (ann.syncState === "complete") toDelete.push(id);
    });
    for (const id of toDelete) {
      const ann = this.annotations.get(id);
      if (ann) await this.store.deleteFile(ann.localUri);
      this.annotations.delete(id);
    }
    await this.persist();
    this.emit("stateChanged");
  }

  async syncAnnotation(localId: string): Promise<void> {
    const annotation = this.annotations.get(localId);
    if (!annotation || annotation.syncState === "complete" || annotation.syncState === "uploading") return;
    if (annotation.retryCount >= MAX_RETRIES) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) return;

    try {
      annotation.syncState = "uploading";
      annotation.lastSyncAttempt = new Date().toISOString();
      annotation.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("stateChanged");

      const fileName = `annotated-${annotation.originalFileName.replace(/\.[^/.]+$/, "")}-${annotation.localId}.jpg`;

      const uploadInfo = await this.withTimeout(
        requestUploadUrl(fileName, "image/jpeg", annotation.fileSize),
        UPLOAD_TIMEOUT,
        "Upload URL request timed out"
      );

      const uploadResult = await this.withTimeout(
        FileSystem.uploadAsync(uploadInfo.uploadURL, annotation.localUri, {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": "image/jpeg" },
        }),
        UPLOAD_TIMEOUT,
        "File upload timed out"
      );

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      await this.withTimeout(
        archiveUploadedFile({
          objectId: uploadInfo.objectId,
          bucketName: uploadInfo.bucketName,
          objectName: uploadInfo.objectName,
          originalName: fileName,
          contentType: "image/jpeg",
          size: annotation.fileSize,
          projectId: annotation.projectId,
          category: "annotations",
        }),
        UPLOAD_TIMEOUT,
        "File archive request timed out"
      );

      annotation.syncState = "complete";
      annotation.syncCompletedAt = new Date().toISOString();
      annotation.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("annotationSynced", annotation);
    } catch (error) {
      annotation.syncState = "failed";
      annotation.retryCount += 1;
      annotation.lastSyncError = error instanceof Error ? error.message : "Unknown error";
      annotation.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("annotationFailed", annotation);
    }
  }

  async syncAllPending(): Promise<void> {
    if (this.isSyncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) return;

    const pending = Array.from(this.annotations.values()).filter(
      (a) => (a.syncState === "pending" || a.syncState === "failed") && a.retryCount < MAX_RETRIES
    );

    if (pending.length === 0) return;

    this.isSyncing = true;
    this.emit("stateChanged");

    for (const annotation of pending) {
      await this.syncAnnotation(annotation.localId);
    }

    this.isSyncing = false;
    this.emit("stateChanged");
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }
}

export const offlineAnnotationService = new OfflineAnnotationService();
