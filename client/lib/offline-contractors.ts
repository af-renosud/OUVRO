import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { DurableQueueStore } from "./durable-queue-store";
import { fetchContractors } from "./archidoc-api";
import type { Contractor, CachedContractorList } from "./archidoc-types";

const CACHE_LOCAL_ID = "contractors";

export interface ContractorListResult {
  contractors: Contractor[];
  /** True when the list was served from the on-device cache (stale data). */
  fromCache: boolean;
  /** ISO timestamp of the last successful server fetch, if any. */
  cachedAt: string | null;
}

/**
 * Offline-first store for the global contractor list ("Entreprise / Lot"
 * picker). Read-only: mirrors the list-cache half of offline-reminders —
 * one durable entry (localId === "contractors") refreshed after every
 * successful fetch and served as a fallback when the network is down.
 * Refreshes automatically on NetInfo reconnect.
 */
class OfflineContractorsService {
  private cache: CachedContractorList | null = null;
  private store = new DurableQueueStore<CachedContractorList>(
    "ouvro_contractor_list",
    "ouvro_contractors",
    "OfflineContractors",
  );

  private isInitialized = false;
  private isRefreshing = false;
  private netInfoUnsubscribe: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const entries = await this.store.load();
      this.cache =
        entries.find((e) => e.localId === CACHE_LOCAL_ID) ?? null;
      this.isInitialized = true;

      this.netInfoUnsubscribe = NetInfo.addEventListener(
        (state: NetInfoState) => {
          if (state.isConnected && !this.isRefreshing) {
            this.refreshFromServer().catch(() => {});
          }
        },
      );
    } catch (error: unknown) {
      console.error("[OfflineContractors] Initialization error:", error);
      this.isInitialized = true;
    }
  }

  destroy(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    this.isInitialized = false;
  }

  getCached(): CachedContractorList | null {
    return this.cache;
  }

  /**
   * Fetches the contractor list from the BFF and refreshes the durable
   * cache. Throws on failure so the caller can fall back to cached data.
   */
  async refreshFromServer(): Promise<Contractor[]> {
    if (this.isRefreshing) {
      // A refresh is already in flight; serve current knowledge.
      return this.cache?.contractors ?? [];
    }
    this.isRefreshing = true;
    try {
      const fresh = await fetchContractors();
      const entry: CachedContractorList = {
        localId: CACHE_LOCAL_ID,
        contractors: fresh,
        cachedAt: new Date().toISOString(),
      };
      this.cache = entry;
      await this.store.save([entry]);
      this.store.emit("listUpdated");
      return fresh;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Offline-first read: try the server, fall back to the durable cache when
   * the fetch fails. Throws only when the fetch fails AND no cache exists,
   * so callers keep an explicit error state (no silent empty list).
   */
  async getContractorsOfflineFirst(): Promise<ContractorListResult> {
    await this.initialize();
    try {
      const fresh = await this.refreshFromServer();
      return { contractors: fresh, fromCache: false, cachedAt: this.cache?.cachedAt ?? null };
    } catch (err: unknown) {
      if (this.cache) {
        return {
          contractors: this.cache.contractors,
          fromCache: true,
          cachedAt: this.cache.cachedAt,
        };
      }
      throw err;
    }
  }
}

export const offlineContractorsService = new OfflineContractorsService();

/** Convenience queryFn for TanStack Query consumers. */
export function getContractorsOfflineFirst(): Promise<ContractorListResult> {
  return offlineContractorsService.getContractorsOfflineFirst();
}
