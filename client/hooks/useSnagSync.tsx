import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import { offlineSnagService, type AddSnagParams } from "@/lib/offline-snags";
import type { PendingSnagCapture } from "@/lib/archidoc-types";

interface SnagSyncContextValue {
  captures: PendingSnagCapture[];
  pendingCount: number;
  isSyncing: boolean;
  addCapture: (params: AddSnagParams) => Promise<string>;
  removeCapture: (localId: string) => Promise<void>;
  retryCapture: (localId: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  syncNow: () => Promise<void>;
  refresh: () => void;
  failedCount: number;
}

const SnagSyncContext = createContext<SnagSyncContextValue | null>(null);

export function SnagSyncProvider({ children }: { children: ReactNode }) {
  const [captures, setCaptures] = useState<PendingSnagCapture[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const init = async () => {
      await offlineSnagService.initialize();
      setCaptures(offlineSnagService.getCaptures());
      setIsSyncing(offlineSnagService.getIsSyncing());
    };
    init();

    const unsubscribe = offlineSnagService.subscribe(() => {
      setCaptures(offlineSnagService.getCaptures());
      setIsSyncing(offlineSnagService.getIsSyncing());
    });

    return () => {
      unsubscribe();
      offlineSnagService.destroy();
    };
  }, []);

  const addCapture = useCallback(async (params: AddSnagParams) => {
    const localId = await offlineSnagService.addCapture(params);
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      offlineSnagService.syncAllPending().catch(() => {});
    }
    return localId;
  }, []);

  const removeCapture = useCallback(async (localId: string) => {
    return offlineSnagService.removeCapture(localId);
  }, []);

  const retryCapture = useCallback(async (localId: string) => {
    return offlineSnagService.retryCapture(localId);
  }, []);

  const retryAllFailed = useCallback(async () => {
    return offlineSnagService.retryAllFailed();
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineSnagService.clearCompleted();
  }, []);

  const syncNow = useCallback(async () => {
    return offlineSnagService.syncAllPending();
  }, []);

  const refresh = useCallback(() => {
    setCaptures(offlineSnagService.getCaptures());
    setIsSyncing(offlineSnagService.getIsSyncing());
  }, []);

  const pendingCount = captures.filter((c) => c.syncState !== "complete").length;
  const failedCount = captures.filter(
    (c) => c.syncState !== "complete" && (c.syncState === "failed" || c.retryCount > 0)
  ).length;

  return (
    <SnagSyncContext.Provider
      value={{
        captures,
        pendingCount,
        isSyncing,
        addCapture,
        removeCapture,
        retryCapture,
        retryAllFailed,
        clearCompleted,
        syncNow,
        refresh,
        failedCount,
      }}
    >
      {children}
    </SnagSyncContext.Provider>
  );
}

export function useSnagSync(): SnagSyncContextValue {
  const ctx = useContext(SnagSyncContext);
  if (!ctx) {
    throw new Error("useSnagSync must be used within a SnagSyncProvider");
  }
  return ctx;
}
