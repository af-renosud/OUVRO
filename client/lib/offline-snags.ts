import * as FileSystem from "expo-file-system/legacy";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { DurableQueueStore } from "./durable-queue-store";
import { getApiUrl } from "./query-client";
import {
  requestUploadUrl,
  uploadFileToSignedUrl,
  submitSnagCapture,
  SnagSubmitError,
} from "./archidoc-api";
import { clientVersionHeaders } from "./client-version";
import type {
  PendingSnagCapture,
  PendingSnagMedia,
  SnagMediaItem,
  SnagSeverity,
  SnagSubmitParams,
  SnagType,
} from "./archidoc-types";

type SnagEventType =
  | "stateChanged"
  | "captureAdded"
  | "captureUpdated"
  | "captureSynced"
  | "captureFailed";

type SnagEventPayload = { localId?: string; error?: string } | undefined;
type SnagEventListener = (event: SnagEventType, data?: SnagEventPayload) => void;

export type AddSnagParams = {
  projectId: string;
  projectName: string;
  type: SnagType;
  title: string;
  description?: string;
  severity?: SnagSeverity;
  contractorId?: string;
  contractorName?: string;
  location?: string;
  media: Array<{
    type: "photo" | "video" | "audio";
    uri: string;
    mimeType: string;
    durationSeconds?: number;
  }>;
  capturedBy?: string;
};

function friendlySnagErrorMessage(err: SnagSubmitError): string {
  switch (err.code) {
    case "VALIDATION_FAILED":
      return `Données invalides : ${err.message}`;
    case "PROJECT_NOT_FOUND":
      return "Projet introuvable dans ARCHIDOC.";
    case "FEATURE_DISABLED":
      return "L'envoi de snags n'est pas activé sur ARCHIDOC. Réessai automatique plus tard.";
    case "MISSING_API_KEY":
      return "Configuration serveur manquante (clé API). Contactez l'administrateur.";
    default:
      break;
  }
  if (err.httpStatus === 401 || err.httpStatus === 403) {
    return "Authentification ARCHIDOC refusée.";
  }
  if (err.httpStatus >= 500) {
    return "Erreur serveur ARCHIDOC. Nouvelle tentative automatique.";
  }
  return err.message || "Échec de l'envoi du snag";
}

class OfflineSnagService {
  private captures: Map<string, PendingSnagCapture> = new Map();
  private store = new DurableQueueStore<PendingSnagCapture>(
    "ouvro_pending_snags",
    "ouvro_snags",
    "OfflineSnags"
  );
  private isInitialized = false;
  private isSyncing = false;
  private autoRetryTimer: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  private static AUTO_RETRY_INTERVAL = 120_000;
  private static MAX_AUTO_RETRIES = 20;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const parsed = await this.store.load();
      parsed.forEach((capture) => {
        if (
          capture.syncState === "uploading_media" ||
          capture.syncState === "uploading_metadata"
        ) {
          capture.syncState = "pending";
          capture.lastSyncError = "Sync interrupted — will retry";
        }
        this.captures.set(capture.localId, capture);
      });
      this.isInitialized = true;

      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        if (state.isConnected && this.getPendingCount() > 0 && !this.isSyncing) {
          // On reconnect, revive snags that exhausted their retries (or were
          // marked failed) so they resume automatically. Media is never lost.
          this.reviveIncomplete();
          this.persist()
            .then(() => {
              this.emit("stateChanged");
              return this.syncAllPending();
            })
            .catch(() => {});
        }
      });

      this.autoRetryTimer = setInterval(() => {
        if (this.getPendingCount() > 0 && !this.isSyncing) {
          const retriable = Array.from(this.captures.values()).filter(
            (c) =>
              c.syncState === "pending" &&
              c.retryCount < OfflineSnagService.MAX_AUTO_RETRIES
          );
          if (retriable.length > 0) {
            this.syncAllPending().catch(() => {});
          }
        }
      }, OfflineSnagService.AUTO_RETRY_INTERVAL);

      const netState = await NetInfo.fetch();
      if (netState.isConnected && this.getPendingCount() > 0) {
        this.syncAllPending().catch(() => {});
      }
    } catch (error) {
      console.error("[OfflineSnags] Initialization error:", error);
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

  subscribe(listener: SnagEventListener): () => void {
    return this.store.subscribe(listener as (event: string, data?: unknown) => void);
  }

  private emit(event: SnagEventType, data?: SnagEventPayload): void {
    this.store.emit(event, data);
  }

  private async persist(): Promise<void> {
    await this.store.save(Array.from(this.captures.values()));
  }

  async addCapture(params: AddSnagParams): Promise<string> {
    const localId = `snag_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    const durableMedia: PendingSnagMedia[] = [];
    for (const m of params.media) {
      const fileName = m.uri.split("/").pop() || `snag_${Date.now()}`;
      const durableUri = await this.store.copyToDurableStorage(m.uri, fileName);
      let fileSize: number | undefined;
      try {
        const info = await FileSystem.getInfoAsync(durableUri);
        if (info.exists && !info.isDirectory) fileSize = info.size;
      } catch {}
      durableMedia.push({
        type: m.type,
        localUri: durableUri,
        fileName,
        mimeType: m.mimeType,
        durationSeconds: m.durationSeconds,
        fileSize,
        uploaded: false,
      });
    }

    const capture: PendingSnagCapture = {
      localId,
      projectId: params.projectId,
      projectName: params.projectName,
      type: params.type,
      title: params.title,
      description: params.description,
      severity: params.severity,
      contractorId: params.contractorId,
      contractorName: params.contractorName,
      location: params.location,
      media: durableMedia,
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
    return localId;
  }

  async removeCapture(localId: string): Promise<void> {
    const capture = this.captures.get(localId);
    if (capture) {
      for (const m of capture.media) {
        await this.store.deleteFile(m.localUri);
      }
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

  // Revive every unfinished capture: reset retry counter, flip failed back to
  // pending, clear stale error. In-flight uploads are left untouched.
  private reviveIncomplete(): void {
    this.captures.forEach((capture) => {
      if (
        capture.syncState === "complete" ||
        capture.syncState === "uploading_media" ||
        capture.syncState === "uploading_metadata"
      ) {
        return;
      }
      capture.syncState = "pending";
      capture.retryCount = 0;
      capture.lastSyncError = undefined;
      capture.modifiedAt = new Date().toISOString();
    });
  }

  // Manual "retry everything" escape hatch for the Queue screen.
  async retryAllFailed(): Promise<void> {
    this.reviveIncomplete();
    await this.persist();
    this.emit("stateChanged");
    this.syncAllPending().catch(() => {});
  }

  async clearCompleted(): Promise<void> {
    const completed: string[] = [];
    this.captures.forEach((c, id) => {
      if (c.syncState === "complete") completed.push(id);
    });
    for (const id of completed) {
      const c = this.captures.get(id);
      if (c) {
        for (const m of c.media) {
          await this.store.deleteFile(m.localUri);
        }
      }
      this.captures.delete(id);
    }
    await this.persist();
    this.emit("stateChanged");
  }

  getCaptures(): PendingSnagCapture[] {
    return Array.from(this.captures.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getPendingCount(): number {
    return Array.from(this.captures.values()).filter(
      (c) => c.syncState !== "complete"
    ).length;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  private async fetchUriAsBlob(uri: string): Promise<Blob> {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Could not read local media at ${uri}`);
    return await res.blob();
  }

  private async uploadOneMedia(
    capture: PendingSnagCapture,
    media: PendingSnagMedia
  ): Promise<void> {
    if (media.uploaded && media.objectPath) return;
    const info = await FileSystem.getInfoAsync(media.localUri);
    if (!info.exists || info.isDirectory) {
      throw new Error(`Snag media file missing: ${media.localUri}`);
    }
    const size = info.size ?? media.fileSize ?? 0;
    const upload = await requestUploadUrl(media.fileName, media.mimeType, size);
    const blob = await this.fetchUriAsBlob(media.localUri);
    await uploadFileToSignedUrl(upload.uploadURL, blob, media.mimeType);
    media.objectPath = upload.objectPath;
    media.publicUrl = upload.publicUrl;
    media.uploaded = true;
    capture.modifiedAt = new Date().toISOString();
    await this.persist();
  }

  private async syncCapture(localId: string): Promise<void> {
    const capture = this.captures.get(localId);
    if (!capture || capture.syncState !== "pending") return;

    capture.syncState = "uploading_media";
    capture.lastSyncAttempt = new Date().toISOString();
    capture.modifiedAt = new Date().toISOString();
    await this.persist();
    this.emit("captureUpdated", { localId });
    this.emit("stateChanged");

    try {
      for (const media of capture.media) {
        if (!media.uploaded) {
          await this.uploadOneMedia(capture, media);
        }
      }

      capture.syncState = "uploading_metadata";
      await this.persist();
      this.emit("captureUpdated", { localId });
      this.emit("stateChanged");

      const submitMedia: SnagMediaItem[] = capture.media.map((m) => ({
        type: m.type,
        objectPath: m.objectPath as string,
        fileName: m.fileName,
        publicUrl: m.publicUrl,
        mimeType: m.mimeType,
        durationSeconds: m.durationSeconds,
      }));

      const params: SnagSubmitParams = {
        localId: capture.localId,
        projectId: capture.projectId,
        projectName: capture.projectName,
        type: capture.type,
        title: capture.title,
        description: capture.description,
        severity: capture.severity,
        contractorId: capture.contractorId,
        contractorName: capture.contractorName,
        location: capture.location,
        media: submitMedia,
        capturedAt: capture.capturedAt,
        capturedBy: capture.capturedBy,
      };

      const baseUrl = getApiUrl();
      const result = await submitSnagCapture(baseUrl, params, clientVersionHeaders());

      capture.syncState = "complete";
      capture.remoteId = result.archidocSnagId;
      capture.deepLink = result.deepLink;
      capture.duplicate = result.duplicate === true;
      capture.syncCompletedAt = new Date().toISOString();
      capture.modifiedAt = new Date().toISOString();
      await this.persist();
      this.emit("captureSynced", { localId });
      this.emit("stateChanged");
    } catch (err: unknown) {
      const isPermanent =
        err instanceof SnagSubmitError && err.isPermanent && !err.isFeatureDisabled;
      const errMsg =
        err instanceof SnagSubmitError
          ? friendlySnagErrorMessage(err)
          : err instanceof Error
            ? err.message
            : "Échec de l'envoi du snag";
      capture.syncState = isPermanent ? "failed" : "pending";
      capture.retryCount += 1;
      capture.lastSyncError = errMsg;
      capture.modifiedAt = new Date().toISOString();
      await this.persist();
      if (isPermanent) {
        this.emit("captureFailed", { localId, error: errMsg });
      } else {
        this.emit("captureUpdated", { localId });
      }
      this.emit("stateChanged");
    }
  }

  async syncAllPending(): Promise<void> {
    if (this.isSyncing) return;
    const pending = Array.from(this.captures.values()).filter(
      (c) =>
        c.syncState === "pending" && c.retryCount < OfflineSnagService.MAX_AUTO_RETRIES
    );
    if (pending.length === 0) return;

    this.isSyncing = true;
    this.emit("stateChanged");
    try {
      for (const c of pending) {
        await this.syncCapture(c.localId);
      }
    } finally {
      this.isSyncing = false;
      this.emit("stateChanged");
    }
  }
}

export const offlineSnagService = new OfflineSnagService();
