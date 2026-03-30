import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
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
  clearCompleted: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const DQESyncContext = createContext<DQESyncContextValue | null>(null);

export function DQESyncProvider({ children }: { children: ReactNode }) {
  const [captures, setCaptures] = useState<PendingDQECapture[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await offlineDQEService.initialize();
      setCaptures(offlineDQEService.getCaptures());
      setIsSyncing(offlineDQEService.getIsSyncing());
      setIsInitialized(true);
    };
    init();

    const unsubscribe = offlineDQEService.subscribe((event) => {
      setCaptures(offlineDQEService.getCaptures());
      setIsSyncing(offlineDQEService.getIsSyncing());
    });

    return unsubscribe;
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
    return offlineDQEService.addCapture(params);
  }, []);

  const removeCapture = useCallback(async (localId: string) => {
    return offlineDQEService.removeCapture(localId);
  }, []);

  const retryCapture = useCallback(async (localId: string) => {
    return offlineDQEService.retryCapture(localId);
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineDQEService.clearCompleted();
  }, []);

  const syncNow = useCallback(async () => {
    return offlineDQEService.syncAllPending();
  }, []);

  const pendingCount = captures.filter((c) => c.syncState !== "complete").length;

  return (
    <DQESyncContext.Provider
      value={{
        captures,
        pendingCount,
        isSyncing,
        addCapture,
        removeCapture,
        retryCapture,
        clearCompleted,
        syncNow,
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
