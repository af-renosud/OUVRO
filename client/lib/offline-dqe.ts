import * as FileSystem from "expo-file-system/legacy";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { DurableQueueStore } from "./durable-queue-store";
import { getApiUrl } from "./query-client";
import { submitDQECapture, DQESubmitError } from "./archidoc-api";
import { mimeTypeFromUri } from "./video-utils";
import type { PendingDQECapture, DQEQualityTier } from "./archidoc-types";

const GCS_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

type DQEEventType =
  | "stateChanged"
  | "captureAdded"
  | "captureUpdated"
  | "captureSynced"
  | "captureFailed";

type DQEEventPayload = { localId?: string; error?: string } | undefined;
type DQEEventListener = (event: DQEEventType, data?: DQEEventPayload) => void;

class OfflineDQEService {
  private captures: Map<string, PendingDQECapture> = new Map();
  private store = new DurableQueueStore<PendingDQECapture>(
    "ouvro_pending_dqe",
    "ouvro_dqe",
    "OfflineDQE"
  );
  private isInitialized = false;
  private isSyncing = false;
  private autoRetryTimer: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  // Sync tunables for queued DQE video captures. Source of truth —
  // these values are NOT mirrored in `replit.md`. If you change them,
  // update the Data Persistence Audit prompt in
  // `client/lib/audit-prompts.ts`.
  //   AUTO_RETRY_INTERVAL — background sync timer (ms). Paired with a
  //                         NetInfo reconnect listener.
  //   MAX_AUTO_RETRIES    — stop auto-retrying after this many failed
  //                         attempts per capture. Capture stays in the
  //                         queue for manual retry.
  private static AUTO_RETRY_INTERVAL = 120000;
  private static MAX_AUTO_RETRIES = 20;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const parsed = await this.store.load();
      parsed.forEach((capture) => {
        if (capture.syncState === "uploading") {
          capture.syncState = "pending";
          capture.lastSyncError = "Upload interrupted — will retry";
        }
        this.captures.set(capture.localId, capture);
      });
      this.isInitialized = true;
      if (__DEV__) console.log("[OfflineDQE] Initialized with", this.captures.size, "captures");

      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        if (state.isConnected && this.getPendingCount() > 0 && !this.isSyncing) {
          if (__DEV__) console.log("[OfflineDQE] Network reconnected, auto-syncing DQE captures");
          this.syncAllPending().catch(() => {});
        }
      });

      this.autoRetryTimer = setInterval(() => {
        if (this.getPendingCount() > 0 && !this.isSyncing) {
          const retriable = Array.from(this.captures.values()).filter(
            (c) => c.syncState === "pending" && c.retryCount < OfflineDQEService.MAX_AUTO_RETRIES
          );
          if (retriable.length > 0) {
            if (__DEV__) console.log("[OfflineDQE] Auto-retry:", retriable.length, "captures");
            this.syncAllPending().catch(() => {});
          }
        }
      }, OfflineDQEService.AUTO_RETRY_INTERVAL);

      const netState = await NetInfo.fetch();
      if (netState.isConnected && this.getPendingCount() > 0) {
        if (__DEV__) console.log("[OfflineDQE] Network available on init, syncing pending captures");
        this.syncAllPending().catch(() => {});
      }
    } catch (error) {
      console.error("[OfflineDQE] Initialization error:", error);
    }
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
    this.isInitialized = false;
  }

  subscribe(listener: DQEEventListener): () => void {
    return this.store.subscribe(listener as (event: string, data?: unknown) => void);
  }

  private emit(event: DQEEventType, data?: DQEEventPayload): void {
    this.store.emit(event, data);
  }

  private async persist(): Promise<void> {
    await this.store.save(Array.from(this.captures.values()));
  }

  async addCapture(params: {
    projectId: string;
    projectName: string;
    videoUri: string;
    videoDuration: number;
    qualityTier: DQEQualityTier;
    architectNotes?: string;
    capturedBy?: string;
  }): Promise<string> {
    const localId = `dqe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const fileName = params.videoUri.split("/").pop() || `dqe_${Date.now()}.mp4`;
    const durableUri = await this.store.copyToDurableStorage(params.videoUri, fileName);

    let videoFileSize: number | undefined;
    try {
      const fileInfo = await FileSystem.getInfoAsync(durableUri);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        videoFileSize = fileInfo.size;
      }
    } catch (e) {
      if (__DEV__) console.warn("[OfflineDQE] Could not get file size:", e);
    }

    const capture: PendingDQECapture = {
      localId,
      projectId: params.projectId,
      projectName: params.projectName,
      videoUri: durableUri,
      videoFileName: fileName,
      videoDuration: params.videoDuration,
      videoFileSize,
      qualityTier: params.qualityTier,
      architectNotes: params.architectNotes,
      capturedAt: now,
      capturedBy: params.capturedBy || "OUVRO Field User",
      syncState: "pending",
      createdAt: now,
      modifiedAt: now,
      retryCount: 0,
    };

    this.captures.set(localId, capture);
    await this.persist();
    this.emit("captureAdded", { localId });
    this.emit("stateChanged");

    if (__DEV__) console.log("[OfflineDQE] Added capture:", localId, "video at:", durableUri);

    return localId;
  }

  async removeCapture(localId: string): Promise<void> {
    const capture = this.captures.get(localId);
    if (capture) {
      await this.store.deleteFile(capture.videoUri);
    }
    this.captures.delete(localId);
    await this.persist();
    this.emit("stateChanged");
  }

  async retryCapture(localId: string): Promise<void> {
    const capture = this.captures.get(localId);
    if (!capture) return;

    capture.syncState = "pending";
    capture.retryCount = 0;
    capture.lastSyncError = undefined;
    capture.modifiedAt = new Date().toISOString();

    await this.persist();
    this.emit("stateChanged");

    this.syncAllPending().catch(() => {});
  }

  async clearCompleted(): Promise<void> {
    const completedIds: string[] = [];
    this.captures.forEach((capture, id) => {
      if (capture.syncState === "complete") {
        completedIds.push(id);
      }
    });

    for (const id of completedIds) {
      const capture = this.captures.get(id);
      if (capture) {
        await this.store.deleteFile(capture.videoUri);
      }
      this.captures.delete(id);
    }

    await this.persist();
    this.emit("stateChanged");
  }

  getCaptures(): PendingDQECapture[] {
    return Array.from(this.captures.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getCapture(localId: string): PendingDQECapture | undefined {
    return this.captures.get(localId);
  }

  getPendingCount(): number {
    return Array.from(this.captures.values()).filter(
      (c) => c.syncState !== "complete"
    ).length;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  private async syncCapture(localId: string): Promise<void> {
    const capture = this.captures.get(localId);
    if (!capture || capture.syncState !== "pending") return;

    capture.syncState = "uploading";
    capture.lastSyncAttempt = new Date().toISOString();
    capture.modifiedAt = new Date().toISOString();
    await this.persist();
    this.emit("captureUpdated", { localId });
    this.emit("stateChanged");

    try {
      const fileInfo = await FileSystem.getInfoAsync(capture.videoUri);
      if (!fileInfo.exists) {
        throw new Error("Video file not found: " + capture.videoUri);
      }

      const baseUrl = getApiUrl();

      const videoMimeType = mimeTypeFromUri(capture.videoUri);

      const urlRes = await fetch(new URL("/api/archidoc/upload-url", baseUrl).href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: capture.videoFileName,
          contentType: videoMimeType,
          assetType: "video",
        }),
      });

      if (!urlRes.ok) {
        const errText = await urlRes.text().catch(() => "");
        throw new Error(`Failed to get upload URL (${urlRes.status}): ${errText}`);
      }

      const { uploadURL, objectPath, publicUrl } = await urlRes.json();

      if (__DEV__) console.log("[OfflineDQE] Uploading video to storage, objectPath:", objectPath);

      const uploadTask = FileSystem.createUploadTask(
        uploadURL,
        capture.videoUri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          // Foreground session: the legacy BACKGROUND default uses a separate-
          // process URLSession that is unreliable in Expo Go and gets cancelled
          // mid-upload ("Upload cancelled").
          sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
          headers: { "Content-Type": videoMimeType },
        }
      );

      let uploadTimeoutId: ReturnType<typeof setTimeout> | undefined;
      const uploadTimeoutPromise = new Promise<never>((_, reject) => {
        uploadTimeoutId = setTimeout(
          () => reject(new Error(`GCS upload timed out after ${GCS_UPLOAD_TIMEOUT_MS / 60000} min`)),
          GCS_UPLOAD_TIMEOUT_MS
        );
      });

      let uploadResult: Awaited<ReturnType<typeof uploadTask.uploadAsync>>;
      try {
        uploadResult = await Promise.race([
          uploadTask.uploadAsync(),
          uploadTimeoutPromise,
        ]);
      } finally {
        clearTimeout(uploadTimeoutId);
      }

      if (__DEV__) console.log("[OfflineDQE] GCS upload status:", uploadResult?.status ?? "no-response");

      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        console.warn(
          "[OfflineDQE] GCS upload failed — status:",
          uploadResult?.status ?? "no-response",
          "body:", uploadResult?.body ? uploadResult.body.slice(0, 300) : "(empty)"
        );
        throw new Error(`Storage upload failed with status ${uploadResult?.status ?? "unknown"}`);
      }

      if (__DEV__) console.log("[OfflineDQE] Video uploaded, submitting DQE metadata...");

      try {
        const submitResult = await submitDQECapture(baseUrl, {
          localId: capture.localId,
          projectId: capture.projectId,
          projectName: capture.projectName,
          videoObjectPath: objectPath,
          ...(typeof publicUrl === "string" && publicUrl ? { videoUrl: publicUrl } : {}),
          videoMimeType,
          architectNotes: capture.architectNotes,
          videoDuration: capture.videoDuration,
          qualityTier: capture.qualityTier,
          capturedAt: capture.capturedAt,
          capturedBy: capture.capturedBy,
        });

        capture.syncState = "complete";
        capture.remoteId = submitResult.archidocDQEId;
        capture.syncCompletedAt = new Date().toISOString();
        capture.modifiedAt = new Date().toISOString();
        await this.persist();
        this.emit("captureSynced", { localId });
        this.emit("stateChanged");
        if (__DEV__) console.log("[OfflineDQE] Capture synced:", localId, "remoteId:", submitResult.archidocDQEId);
      } catch (submitErr: unknown) {
        const errMsg = submitErr instanceof Error ? submitErr.message : "Submit failed";
        const isPermanent = submitErr instanceof DQESubmitError && submitErr.isPermanent;
        if (isPermanent) {
          capture.syncState = "failed";
          capture.lastSyncError = errMsg;
          capture.modifiedAt = new Date().toISOString();
          await this.persist();
          this.emit("captureFailed", { localId, error: capture.lastSyncError });
          this.emit("stateChanged");
          if (__DEV__) console.warn("[OfflineDQE] Capture permanently failed:", localId, errMsg);
        } else {
          capture.syncState = "pending";
          capture.retryCount += 1;
          capture.lastSyncError = errMsg;
          capture.modifiedAt = new Date().toISOString();
          await this.persist();
          this.emit("captureUpdated", { localId });
          this.emit("stateChanged");
          if (__DEV__) console.warn("[OfflineDQE] Capture transient error, will retry:", localId, errMsg);
        }
      }
    } catch (error: unknown) {
      capture.syncState = "pending";
      capture.retryCount += 1;
      capture.lastSyncError = error instanceof Error ? error.message : "Network error";
      capture.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("captureUpdated", { localId });
      this.emit("stateChanged");
      if (__DEV__) console.warn("[OfflineDQE] Capture sync error:", localId, error);
    }
  }

  async syncAllPending(): Promise<void> {
    if (this.isSyncing) {
      if (__DEV__) console.log("[OfflineDQE] syncAllPending: already syncing, skipping");
      return;
    }

    const pendingCaptures = Array.from(this.captures.values()).filter(
      (c) => c.syncState === "pending" && c.retryCount < OfflineDQEService.MAX_AUTO_RETRIES
    );

    if (pendingCaptures.length === 0) return;

    this.isSyncing = true;
    this.emit("stateChanged");
    if (__DEV__) console.log("[OfflineDQE] syncAllPending:", pendingCaptures.length, "captures");

    try {
      for (const capture of pendingCaptures) {
        await this.syncCapture(capture.localId);
      }
    } finally {
      this.isSyncing = false;
      this.emit("stateChanged");
    }
  }
}

export const offlineDQEService = new OfflineDQEService();
