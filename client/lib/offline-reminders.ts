import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { DurableQueueStore } from "./durable-queue-store";
import {
  fetchSiteReminders,
  patchSiteReminderDone,
  SiteReminderApiError,
} from "./archidoc-api";
import type {
  SiteReminder,
  SiteReminderAttachment,
  PendingReminderToggle,
  CachedReminderList,
} from "./archidoc-types";

type ReminderEventType =
  | "stateChanged"
  | "listUpdated"
  | "toggleQueued"
  | "toggleSynced"
  | "toggleFailed";

type ReminderEventPayload =
  | { projectId?: string; reminderId?: string; error?: string }
  | undefined;
type ReminderEventListener = (
  event: ReminderEventType,
  data?: ReminderEventPayload,
) => void;

function toggleLocalId(projectId: string, reminderId: string): string {
  return `toggle_${projectId}_${reminderId}`;
}

/**
 * `url` on attachments is short-lived and must never be persisted. Strip it
 * before any reminder list is written to durable storage.
 */
function stripEphemeralUrls(reminders: SiteReminder[]): SiteReminder[] {
  return reminders.map((r) => ({
    ...r,
    attachments: r.attachments.map(
      ({ url: _url, ...rest }): SiteReminderAttachment => ({ ...rest }),
    ),
  }));
}

/**
 * Offline-first store for Site Reminders ("Points à vérifier").
 *
 *  - List cache (one entry per project, localId === projectId) provides instant,
 *    signal-free reads in the field. Attachment URLs are stripped before caching.
 *  - Toggle queue holds optimistic is_done changes (localId dedups per reminder)
 *    until ARCHIDOC confirms them. Reconciles on reconnect + interval.
 */
class OfflineRemindersService {
  private listCache: Map<string, CachedReminderList> = new Map();
  /**
   * Volatile, in-memory copy of each project's reminders that RETAINS ephemeral
   * attachment `url`s for display. Never persisted. `listCache` (stripped) is the
   * durable fallback used after a cold start before the next server refresh.
   */
  private liveReminders: Map<string, SiteReminder[]> = new Map();
  private toggles: Map<string, PendingReminderToggle> = new Map();

  /** Monotonic counter assigning a unique opSeq to every user-initiated toggle. */
  private nextOpSeq = 1;

  /**
   * Per-project monotonic refresh token. Bumped when a refresh starts AND when a
   * toggle reconciles, so an older in-flight GET (captured a lower token) can
   * detect it is stale and refuse to overwrite newer canonical state.
   */
  private refreshSeq: Map<string, number> = new Map();

  private listStore = new DurableQueueStore<CachedReminderList>(
    "ouvro_reminder_lists",
    "ouvro_reminders",
    "OfflineReminders",
  );
  private toggleStore = new DurableQueueStore<PendingReminderToggle>(
    "ouvro_reminder_toggles",
    "ouvro_reminders",
    "OfflineReminders",
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
      const cachedLists = await this.listStore.load();
      cachedLists.forEach((entry) => this.listCache.set(entry.localId, entry));

      const queuedToggles = await this.toggleStore.load();
      queuedToggles.forEach((t) => {
        if (t.syncState === "uploading") {
          t.syncState = "pending";
          t.lastSyncError = "Sync interrupted — will retry";
        }
        if (typeof t.opSeq !== "number") {
          t.opSeq = this.nextOpSeq++;
        } else if (t.opSeq >= this.nextOpSeq) {
          this.nextOpSeq = t.opSeq + 1;
        }
        this.toggles.set(t.localId, t);
      });

      this.isInitialized = true;

      this.netInfoUnsubscribe = NetInfo.addEventListener(
        (state: NetInfoState) => {
          if (
            state.isConnected &&
            this.getPendingCount() > 0 &&
            !this.isSyncing
          ) {
            this.syncAllPending().catch(() => {});
          }
        },
      );

      this.autoRetryTimer = setInterval(() => {
        if (this.getPendingCount() > 0 && !this.isSyncing) {
          const retriable = Array.from(this.toggles.values()).filter(
            (t) =>
              t.syncState === "pending" &&
              t.retryCount < OfflineRemindersService.MAX_AUTO_RETRIES,
          );
          if (retriable.length > 0) {
            this.syncAllPending().catch(() => {});
          }
        }
      }, OfflineRemindersService.AUTO_RETRY_INTERVAL);

      const netState = await NetInfo.fetch();
      if (netState.isConnected && this.getPendingCount() > 0) {
        this.syncAllPending().catch(() => {});
      }
    } catch (error: unknown) {
      console.error("[OfflineReminders] Initialization error:", error);
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

  subscribe(listener: ReminderEventListener): () => void {
    return this.listStore.subscribe(
      listener as (event: string, data?: unknown) => void,
    );
  }

  private emit(event: ReminderEventType, data?: ReminderEventPayload): void {
    this.listStore.emit(event, data);
  }

  private async persistLists(): Promise<void> {
    await this.listStore.save(Array.from(this.listCache.values()));
  }

  private async persistToggles(): Promise<void> {
    await this.toggleStore.save(Array.from(this.toggles.values()));
  }

  /** Applies any pending optimistic toggles on top of a base reminder list. */
  private applyPendingToggles(
    projectId: string,
    reminders: SiteReminder[],
  ): SiteReminder[] {
    return reminders.map((r) => {
      const pending = this.toggles.get(toggleLocalId(projectId, r.id));
      if (pending && pending.syncState !== "complete") {
        return { ...r, isDone: pending.isDone };
      }
      return r;
    });
  }

  /**
   * Cached reminders for a project, with optimistic toggles applied. Prefers the
   * volatile in-memory copy (which still has attachment URLs); falls back to the
   * stripped durable cache after a cold start.
   */
  getReminders(projectId: string): SiteReminder[] {
    const base =
      this.liveReminders.get(projectId) ??
      this.listCache.get(projectId)?.reminders;
    if (!base) return [];
    return this.applyPendingToggles(projectId, base).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  getCachedAt(projectId: string): string | null {
    return this.listCache.get(projectId)?.cachedAt ?? null;
  }

  getPendingCount(): number {
    return Array.from(this.toggles.values()).filter(
      (t) => t.syncState === "pending" || t.syncState === "uploading",
    ).length;
  }

  hasPendingToggle(projectId: string, reminderId: string): boolean {
    const t = this.toggles.get(toggleLocalId(projectId, reminderId));
    return !!t && (t.syncState === "pending" || t.syncState === "uploading");
  }

  hasFailedToggle(projectId: string, reminderId: string): boolean {
    const t = this.toggles.get(toggleLocalId(projectId, reminderId));
    return !!t && t.syncState === "failed";
  }

  private bumpRefreshSeq(projectId: string): number {
    const next = (this.refreshSeq.get(projectId) ?? 0) + 1;
    this.refreshSeq.set(projectId, next);
    return next;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Fetches the latest reminders from ARCHIDOC (via BFF) and refreshes the
   * durable cache. Throws on network/HTTP failure so the caller can fall back to
   * cached data. URLs are kept in memory for display but stripped before caching.
   */
  async refreshFromServer(projectId: string): Promise<SiteReminder[]> {
    const token = this.bumpRefreshSeq(projectId);
    const fresh = await fetchSiteReminders(projectId);

    // A newer refresh or a toggle reconcile happened while this GET was in
    // flight — its payload is stale, so do not overwrite the canonical state.
    if (this.refreshSeq.get(projectId) !== token) {
      return this.getReminders(projectId);
    }

    this.liveReminders.set(projectId, fresh);
    const entry: CachedReminderList = {
      localId: projectId,
      reminders: stripEphemeralUrls(fresh),
      cachedAt: new Date().toISOString(),
    };
    this.listCache.set(projectId, entry);
    await this.persistLists();
    this.emit("listUpdated", { projectId });
    this.emit("stateChanged");
    return this.applyPendingToggles(projectId, fresh).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  /**
   * Optimistically toggles is_done: updates the cache immediately, enqueues the
   * change, then attempts to sync if online. Dedupes by reminder (localId).
   */
  async toggleDone(
    projectId: string,
    reminderId: string,
    isDone: boolean,
  ): Promise<void> {
    const now = new Date().toISOString();
    const localId = toggleLocalId(projectId, reminderId);
    const existing = this.toggles.get(localId);

    const toggle: PendingReminderToggle = {
      localId,
      projectId,
      reminderId,
      isDone,
      syncState: "pending",
      opSeq: this.nextOpSeq++,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
      retryCount: 0,
      lastSyncError: undefined,
    };
    this.toggles.set(localId, toggle);
    await this.persistToggles();

    this.emit("toggleQueued", { projectId, reminderId });
    this.emit("stateChanged");

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      this.syncAllPending().catch(() => {});
    }
  }

  private async syncToggle(localId: string): Promise<void> {
    const toggle = this.toggles.get(localId);
    if (!toggle || toggle.syncState !== "pending") return;

    // Snapshot the op we are about to send. If the user re-toggles this reminder
    // while the request is in flight, toggleDone() replaces the map entry with a
    // higher opSeq — we must NOT delete/clobber that newer intent on completion.
    const sentOpSeq = toggle.opSeq;

    toggle.syncState = "uploading";
    toggle.lastSyncAttempt = new Date().toISOString();
    toggle.modifiedAt = new Date().toISOString();
    await this.persistToggles();
    this.emit("stateChanged");

    try {
      const updated = await patchSiteReminderDone(
        toggle.projectId,
        toggle.reminderId,
        toggle.isDone,
      );

      const current = this.toggles.get(localId);
      if (current && current.opSeq !== sentOpSeq) {
        // Superseded by a newer toggle — leave it pending for the next pass and
        // do not reconcile the cache to this now-stale value.
        return;
      }

      // Reconcile both the live (URL-bearing) and durable (stripped) copies with
      // ARCHIDOC's canonical value, and invalidate any older in-flight GET.
      this.bumpRefreshSeq(toggle.projectId);
      const live = this.liveReminders.get(toggle.projectId);
      if (live) {
        const idx = live.findIndex((r) => r.id === updated.id);
        if (idx >= 0) live[idx] = updated;
      }
      const entry = this.listCache.get(toggle.projectId);
      if (entry) {
        const idx = entry.reminders.findIndex((r) => r.id === updated.id);
        if (idx >= 0) {
          entry.reminders[idx] = stripEphemeralUrls([updated])[0];
          await this.persistLists();
        }
      }

      this.toggles.delete(localId);
      await this.persistToggles();
      this.emit("toggleSynced", {
        projectId: toggle.projectId,
        reminderId: toggle.reminderId,
      });
      this.emit("stateChanged");
    } catch (err: unknown) {
      const current = this.toggles.get(localId);
      if (current && current.opSeq !== sentOpSeq) {
        // A newer toggle superseded this one; let it drive the next sync pass.
        return;
      }
      const isPermanent =
        err instanceof SiteReminderApiError && err.isPermanent;
      const errMsg =
        err instanceof SiteReminderApiError
          ? friendlyReminderError(err)
          : err instanceof Error
            ? err.message
            : "Échec de la synchronisation";
      toggle.retryCount += 1;
      // Terminal failure: a hard rejection, or the auto-retry ceiling is reached.
      // Otherwise stay pending for the next reconnect/interval pass. Either way
      // the user can force a fresh attempt via retryToggle().
      const isTerminal =
        isPermanent ||
        toggle.retryCount >= OfflineRemindersService.MAX_AUTO_RETRIES;
      toggle.syncState = isTerminal ? "failed" : "pending";
      toggle.lastSyncError = errMsg;
      toggle.modifiedAt = new Date().toISOString();
      await this.persistToggles();
      if (isTerminal) {
        this.emit("toggleFailed", {
          projectId: toggle.projectId,
          reminderId: toggle.reminderId,
          error: errMsg,
        });
      }
      this.emit("stateChanged");
    }
  }

  async syncAllPending(): Promise<void> {
    if (this.isSyncing) return;

    const hasEligible = (): boolean =>
      Array.from(this.toggles.values()).some(
        (t) =>
          t.syncState === "pending" &&
          t.retryCount < OfflineRemindersService.MAX_AUTO_RETRIES,
      );
    if (!hasEligible()) return;

    this.isSyncing = true;
    this.emit("stateChanged");
    try {
      // Attempt each (localId, opSeq) at most once per pass. A transient failure
      // keeps the same opSeq → not retried this pass (handled by interval/
      // reconnect). A re-toggle gets a NEW opSeq → re-sent once, here.
      const attempted = new Map<string, number>();
      let guard = 0;
      while (guard++ < 500) {
        const next = Array.from(this.toggles.values()).find(
          (t) =>
            t.syncState === "pending" &&
            t.retryCount < OfflineRemindersService.MAX_AUTO_RETRIES &&
            attempted.get(t.localId) !== t.opSeq,
        );
        if (!next) break;
        attempted.set(next.localId, next.opSeq);
        await this.syncToggle(next.localId);
      }
    } finally {
      this.isSyncing = false;
      this.emit("stateChanged");
    }
  }

  /** Retries a failed toggle (resets retry counter). */
  async retryToggle(projectId: string, reminderId: string): Promise<void> {
    const localId = toggleLocalId(projectId, reminderId);
    const toggle = this.toggles.get(localId);
    if (!toggle) return;
    toggle.syncState = "pending";
    toggle.retryCount = 0;
    toggle.opSeq = this.nextOpSeq++;
    toggle.lastSyncError = undefined;
    toggle.modifiedAt = new Date().toISOString();
    await this.persistToggles();
    this.emit("stateChanged");
    this.syncAllPending().catch(() => {});
  }
}

function friendlyReminderError(err: SiteReminderApiError): string {
  if (err.httpStatus === 0) {
    return "Hors ligne — la modification sera synchronisée plus tard.";
  }
  if (err.httpStatus === 401 || err.httpStatus === 403) {
    return "Authentification ARCHIDOC refusée.";
  }
  if (err.httpStatus === 404) {
    return "Point à vérifier introuvable dans ARCHIDOC.";
  }
  if (err.httpStatus >= 500) {
    return "Erreur serveur ARCHIDOC. Nouvelle tentative automatique.";
  }
  return err.message || "Échec de la synchronisation";
}

export const offlineRemindersService = new OfflineRemindersService();
