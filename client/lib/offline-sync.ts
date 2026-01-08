import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "./query-client";

const STORAGE_KEYS = {
  PENDING_OBSERVATIONS: "ouvro_pending_observations",
  SYNC_SETTINGS: "ouvro_sync_settings",
  UPLOAD_PROGRESS: "ouvro_upload_progress",
};

export type MediaSyncState = "pending" | "uploading" | "complete" | "failed";

export interface OfflineMedia {
  id: string;
  type: "photo" | "video" | "audio";
  localUri: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
  syncState: MediaSyncState;
  uploadProgress: number;
  retryCount: number;
  lastError?: string;
  remoteUrl?: string;
}

export type ObservationSyncState = 
  | "pending"
  | "uploading_metadata"
  | "uploading_media"
  | "partial"
  | "complete"
  | "failed";

export interface OfflineObservation {
  localId: string;
  projectId: string;
  archidocProjectId: string;
  projectName: string;
  title: string;
  description?: string;
  transcription?: string;
  translatedText?: string;
  contractorName?: string;
  contractorEmail?: string;
  media: OfflineMedia[];
  syncState: ObservationSyncState;
  remoteObservationId?: number;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  retryCount: number;
  totalMediaSize: number;
  uploadedMediaSize: number;
}

export interface SyncSettings {
  wifiOnly: boolean;
  autoSync: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface SyncProgress {
  isActive: boolean;
  currentObservationId?: string;
  currentMediaId?: string;
  overallProgress: number;
  currentFileProgress: number;
  filesUploaded: number;
  filesTotal: number;
  bytesUploaded: number;
  bytesTotal: number;
}

type SyncEventType = 
  | "stateChanged"
  | "progressUpdated"
  | "observationSynced"
  | "observationFailed"
  | "networkChanged"
  | "syncStarted"
  | "syncCompleted"
  | "syncError";

type SyncEventListener = (event: SyncEventType, data?: any) => void;

const DEFAULT_SETTINGS: SyncSettings = {
  wifiOnly: false,
  autoSync: false,
  maxRetries: 3,
  retryDelayMs: 5000,
};

class OfflineSyncService {
  private observations: Map<string, OfflineObservation> = new Map();
  private settings: SyncSettings = DEFAULT_SETTINGS;
  private listeners: Set<SyncEventListener> = new Set();
  private isInitialized = false;
  private isSyncing = false;
  private currentAbortController?: AbortController;
  private networkState: NetInfoState | null = null;
  private syncProgress: SyncProgress = {
    isActive: false,
    overallProgress: 0,
    currentFileProgress: 0,
    filesUploaded: 0,
    filesTotal: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const [obsData, settingsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PENDING_OBSERVATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.SYNC_SETTINGS),
      ]);

      if (obsData) {
        const parsed = JSON.parse(obsData) as OfflineObservation[];
        parsed.forEach((obs) => this.observations.set(obs.localId, obs));
      }

      if (settingsData) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
      }

      NetInfo.addEventListener((state) => {
        const wasConnected = this.networkState?.isConnected;
        this.networkState = state;
        this.emit("networkChanged", { 
          isConnected: state.isConnected, 
          isWifi: state.type === "wifi" 
        });

        if (!wasConnected && state.isConnected && this.settings.autoSync) {
          this.startSync();
        }
      });

      this.networkState = await NetInfo.fetch();
      this.isInitialized = true;
      
      if (__DEV__) console.log("[OfflineSync] Initialized with", this.observations.size, "pending observations");
    } catch (error) {
      console.error("[OfflineSync] Initialization error:", error);
    }
  }

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEventType, data?: any): void {
    this.listeners.forEach((listener) => listener(event, data));
  }

  private async persist(): Promise<void> {
    try {
      const obsArray = Array.from(this.observations.values());
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_OBSERVATIONS,
        JSON.stringify(obsArray)
      );
    } catch (error) {
      console.error("[OfflineSync] Persist error:", error);
    }
  }

  async saveSettings(settings: Partial<SyncSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem(
      STORAGE_KEYS.SYNC_SETTINGS,
      JSON.stringify(this.settings)
    );
    this.emit("stateChanged");
  }

  getSettings(): SyncSettings {
    return { ...this.settings };
  }

  async addObservation(observation: Omit<OfflineObservation, "localId" | "syncState" | "retryCount" | "totalMediaSize" | "uploadedMediaSize" | "createdAt" | "modifiedAt">): Promise<string> {
    const localId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const totalMediaSize = observation.media.reduce((sum, m) => sum + (m.fileSize || 0), 0);
    
    const offlineObs: OfflineObservation = {
      ...observation,
      localId,
      syncState: "pending",
      retryCount: 0,
      totalMediaSize,
      uploadedMediaSize: 0,
      createdAt: now,
      modifiedAt: now,
      media: observation.media.map((m) => ({
        ...m,
        syncState: "pending" as MediaSyncState,
        uploadProgress: 0,
        retryCount: 0,
      })),
    };

    this.observations.set(localId, offlineObs);
    await this.persist();
    this.emit("stateChanged");
    
    if (__DEV__) console.log("[OfflineSync] Added observation:", localId);
    
    if (this.settings.autoSync && this.canSync()) {
      this.startSync();
    }
    
    return localId;
  }

  async updateObservation(localId: string, updates: Partial<Pick<OfflineObservation, "title" | "description" | "transcription" | "translatedText">>): Promise<void> {
    const obs = this.observations.get(localId);
    if (!obs) return;

    obs.modifiedAt = new Date().toISOString();
    Object.assign(obs, updates);

    if (obs.syncState === "complete" || obs.syncState === "partial") {
      obs.syncState = "pending";
    }

    await this.persist();
    this.emit("stateChanged");
  }

  async removeObservation(localId: string): Promise<void> {
    const obs = this.observations.get(localId);
    if (obs) {
      for (const media of obs.media) {
        if (media.localUri && !media.localUri.startsWith("mock://")) {
          try {
            await FileSystem.deleteAsync(media.localUri, { idempotent: true });
          } catch (e) {
            if (__DEV__) console.warn("[OfflineSync] Failed to delete media file:", media.localUri);
          }
        }
      }
    }
    
    this.observations.delete(localId);
    await this.persist();
    this.emit("stateChanged");
  }

  getObservations(): OfflineObservation[] {
    return Array.from(this.observations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getObservation(localId: string): OfflineObservation | undefined {
    return this.observations.get(localId);
  }

  getPendingCount(): number {
    return Array.from(this.observations.values()).filter(
      (obs) => obs.syncState !== "complete"
    ).length;
  }

  getSyncProgress(): SyncProgress {
    return { ...this.syncProgress };
  }

  isNetworkAvailable(): boolean {
    if (!this.networkState?.isConnected) return false;
    if (this.settings.wifiOnly && this.networkState.type !== "wifi") return false;
    return true;
  }

  private canSync(): boolean {
    return this.isNetworkAvailable() && !this.isSyncing;
  }

  async startSync(): Promise<void> {
    if (this.isSyncing) {
      if (__DEV__) console.log("[OfflineSync] Sync already in progress");
      return;
    }

    if (!this.isNetworkAvailable()) {
      if (__DEV__) console.log("[OfflineSync] Network not available for sync");
      return;
    }

    const pendingObs = this.getObservations().filter(
      (obs) => obs.syncState !== "complete" && obs.retryCount < this.settings.maxRetries
    );

    if (pendingObs.length === 0) {
      if (__DEV__) console.log("[OfflineSync] No pending observations to sync");
      return;
    }

    this.isSyncing = true;
    this.currentAbortController = new AbortController();
    
    this.syncProgress = {
      isActive: true,
      overallProgress: 0,
      currentFileProgress: 0,
      filesUploaded: 0,
      filesTotal: pendingObs.reduce((sum, obs) => sum + obs.media.length, 0),
      bytesUploaded: 0,
      bytesTotal: pendingObs.reduce((sum, obs) => sum + obs.totalMediaSize, 0),
    };
    
    this.emit("syncStarted");
    this.emit("progressUpdated", this.syncProgress);

    try {
      for (const obs of pendingObs) {
        if (this.currentAbortController.signal.aborted) break;
        
        await this.syncObservation(obs);
      }
      
      this.emit("syncCompleted");
    } catch (error) {
      console.error("[OfflineSync] Sync error:", error);
      this.emit("syncError", error);
    } finally {
      this.isSyncing = false;
      this.syncProgress.isActive = false;
      this.emit("progressUpdated", this.syncProgress);
    }
  }

  cancelSync(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.isSyncing = false;
    this.syncProgress.isActive = false;
    this.emit("stateChanged");
  }

  async retryObservation(localId: string): Promise<void> {
    const obs = this.observations.get(localId);
    if (!obs) return;

    obs.syncState = "pending";
    obs.retryCount = 0;
    obs.lastSyncError = undefined;
    
    obs.media.forEach((m) => {
      if (m.syncState === "failed") {
        m.syncState = "pending";
        m.retryCount = 0;
        m.lastError = undefined;
      }
    });

    await this.persist();
    this.emit("stateChanged");
    
    if (this.canSync()) {
      this.startSync();
    }
  }

  private async syncObservation(obs: OfflineObservation): Promise<void> {
    const localId = obs.localId;
    this.syncProgress.currentObservationId = localId;
    
    try {
      obs.lastSyncAttempt = new Date().toISOString();
      
      if (!obs.remoteObservationId) {
        obs.syncState = "uploading_metadata";
        this.emit("stateChanged");
        await this.persist();

        const response = await apiRequest("POST", "/api/archidoc/create-observation", {
          projectId: obs.archidocProjectId,
          title: obs.title,
          description: obs.description,
          transcription: obs.transcription,
          translatedText: obs.translatedText,
          contractorName: obs.contractorName,
          contractorEmail: obs.contractorEmail,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create observation");
        }

        const result = await response.json();
        obs.remoteObservationId = result.archidocObservationId;
        await this.persist();
      }

      obs.syncState = "uploading_media";
      this.emit("stateChanged");
      await this.persist();

      const pendingMedia = obs.media.filter((m) => m.syncState !== "complete");
      
      for (const media of pendingMedia) {
        if (this.currentAbortController?.signal.aborted) {
          throw new Error("Sync cancelled");
        }

        await this.uploadMedia(obs, media);
      }

      const allComplete = obs.media.every((m) => m.syncState === "complete");
      
      if (allComplete) {
        obs.syncState = "complete";
        obs.uploadedMediaSize = obs.totalMediaSize;
        this.emit("observationSynced", { localId, remoteId: obs.remoteObservationId });
      } else {
        obs.syncState = "partial";
        this.emit("observationFailed", { localId, error: "Some media failed to upload" });
      }

    } catch (error) {
      obs.syncState = "failed";
      obs.retryCount++;
      obs.lastSyncError = error instanceof Error ? error.message : "Unknown error";
      this.emit("observationFailed", { localId, error: obs.lastSyncError });
    }

    await this.persist();
    this.emit("stateChanged");
  }

  private async uploadMedia(obs: OfflineObservation, media: OfflineMedia): Promise<void> {
    if (!obs.remoteObservationId) {
      throw new Error("No remote observation ID");
    }

    if (!media.localUri || media.localUri.startsWith("mock://")) {
      media.syncState = "complete";
      media.uploadProgress = 100;
      return;
    }

    this.syncProgress.currentMediaId = media.id;
    media.syncState = "uploading";
    this.emit("progressUpdated", this.syncProgress);

    try {
      const fileInfo = await FileSystem.getInfoAsync(media.localUri);
      if (!fileInfo.exists) {
        throw new Error("File not found: " + media.localUri);
      }

      const fileSize = (fileInfo as any).size || media.fileSize || 0;
      
      // Set initial progress
      media.uploadProgress = 5;
      this.syncProgress.currentFileProgress = 5;
      this.emit("progressUpdated", this.syncProgress);

      if (this.currentAbortController?.signal.aborted) {
        throw new Error("Upload cancelled");
      }

      // Step 1: Get signed upload URL from server (fast, small request)
      const urlResponse = await apiRequest("POST", "/api/archidoc/get-upload-url", {
        fileName: media.fileName,
        contentType: media.contentType,
        assetType: media.type,
      });
      
      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await urlResponse.json();
      
      media.uploadProgress = 10;
      this.syncProgress.currentFileProgress = 10;
      this.emit("progressUpdated", this.syncProgress);

      // Step 2: Upload directly to storage using native binary upload (fastest method)
      const uploadTask = FileSystem.createUploadTask(
        uploadURL,
        media.localUri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": media.contentType },
        },
        (progress) => {
          // Map progress from 10-90% range (leaving room for URL request and registration)
          const percent = 10 + Math.round((progress.totalBytesSent / progress.totalBytesExpectedToSend) * 80);
          media.uploadProgress = percent;
          this.syncProgress.currentFileProgress = percent;
          
          const previousMediaBytes = obs.media
            .filter((m) => m.syncState === "complete")
            .reduce((sum, m) => sum + (m.fileSize || 0), 0);
          
          this.syncProgress.bytesUploaded = previousMediaBytes + progress.totalBytesSent;
          this.syncProgress.overallProgress = Math.round(
            (this.syncProgress.bytesUploaded / this.syncProgress.bytesTotal) * 100
          );
          
          this.emit("progressUpdated", this.syncProgress);
        }
      );

      const uploadResult = await uploadTask.uploadAsync();
      
      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Storage upload failed with status ${uploadResult?.status}`);
      }

      media.uploadProgress = 95;
      this.syncProgress.currentFileProgress = 95;
      this.emit("progressUpdated", this.syncProgress);

      // Step 3: Register asset in ARCHIDOC (fast, small request)
      const registerResponse = await apiRequest("POST", "/api/archidoc/register-asset", {
        observationId: obs.remoteObservationId,
        assetType: media.type,
        objectPath,
        fileName: media.fileName,
        mimeType: media.contentType,
      });

      if (!registerResponse.ok) {
        throw new Error("Failed to register asset");
      }

      media.remoteUrl = objectPath;
      media.syncState = "complete";
      media.uploadProgress = 100;
      
      this.syncProgress.filesUploaded++;
      obs.uploadedMediaSize += fileSize;
      
      this.emit("progressUpdated", this.syncProgress);
      await this.persist();

    } catch (error) {
      media.syncState = "failed";
      media.retryCount++;
      media.lastError = error instanceof Error ? error.message : "Unknown error";
      
      if (media.retryCount < this.settings.maxRetries) {
        await this.delay(this.settings.retryDelayMs * Math.pow(2, media.retryCount - 1));
        return this.uploadMedia(obs, media);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async clearCompleted(): Promise<void> {
    const completed = Array.from(this.observations.entries())
      .filter(([_, obs]) => obs.syncState === "complete")
      .map(([id]) => id);
    
    completed.forEach((id) => this.observations.delete(id));
    await this.persist();
    this.emit("stateChanged");
  }
}

export const offlineSyncService = new OfflineSyncService();
