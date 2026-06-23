import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import { offlineDQEService } from "@/lib/offline-dqe";
import type { PendingDQECapture, DQEQualityTier } from "@/lib/archidoc-types";

interface DQESyncContextValue {
  captures: PendingDQECapture[];
  pendingCount: number;
  isSyncing: boolean;
  addCapture: (params: {
    projectId: string;
    projectName: string;
    videoUri: string;
    videoDuration: number;
    qualityTier: DQEQualityTier;
    architectNotes?: string;
    capturedBy?: string;
  }) => Promise<string>;
  removeCapture: (localId: string) => Promise<void>;
  retryCapture: (localId: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  syncNow: () => Promise<void>;
  refresh: () => void;
  failedCount: number;
}

const DQESyncContext = createContext<DQESyncContextValue | null>(null);

export function DQESyncProvider({ children }: { children: ReactNode }) {
  const [captures, setCaptures] = useState<PendingDQECapture[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const init = async () => {
      await offlineDQEService.initialize();
      setCaptures(offlineDQEService.getCaptures());
      setIsSyncing(offlineDQEService.getIsSyncing());
    };
    init();

    const unsubscribe = offlineDQEService.subscribe((_event) => {
      setCaptures(offlineDQEService.getCaptures());
      setIsSyncing(offlineDQEService.getIsSyncing());
    });

    return () => {
      unsubscribe();
      offlineDQEService.destroy();
    };
  }, []);

  const addCapture = useCallback(async (params: {
    projectId: string;
    projectName: string;
    videoUri: string;
    videoDuration: number;
    qualityTier: DQEQualityTier;
    architectNotes?: string;
    capturedBy?: string;
  }) => {
    const localId = await offlineDQEService.addCapture(params);
    // Trigger immediate sync when online so the user sees progress quickly
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      offlineDQEService.syncAllPending().catch(() => {
        // Background sync — ignore errors (queue will retry automatically)
      });
    }
    return localId;
  }, []);

  const removeCapture = useCallback(async (localId: string) => {
    return offlineDQEService.removeCapture(localId);
  }, []);

  const retryCapture = useCallback(async (localId: string) => {
    return offlineDQEService.retryCapture(localId);
  }, []);

  const retryAllFailed = useCallback(async () => {
    return offlineDQEService.retryAllFailed();
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineDQEService.clearCompleted();
  }, []);

  const syncNow = useCallback(async () => {
    return offlineDQEService.syncAllPending();
  }, []);

  const refresh = useCallback(() => {
    setCaptures(offlineDQEService.getCaptures());
    setIsSyncing(offlineDQEService.getIsSyncing());
  }, []);

  const pendingCount = captures.filter((c) => c.syncState !== "complete").length;
  const failedCount = captures.filter(
    (c) => c.syncState !== "complete" && (c.syncState === "failed" || c.retryCount > 0)
  ).length;

  return (
    <DQESyncContext.Provider
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
    </DQESyncContext.Provider>
  );
}

export function useDQESync(): DQESyncContextValue {
  const ctx = useContext(DQESyncContext);
  if (!ctx) {
    throw new Error("useDQESync must be used within a DQESyncProvider");
  }
  return ctx;
}
