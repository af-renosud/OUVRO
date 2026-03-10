import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { offlineAnnotationService, OfflineAnnotation } from "@/lib/offline-annotations";

interface OfflineAnnotationsContextValue {
  annotations: OfflineAnnotation[];
  pendingCount: number;
  isAnnotationSyncing: boolean;
  addAnnotation: (params: {
    capturedUri: string;
    projectId: string;
    projectName: string;
    originalFileName: string;
  }) => Promise<string>;
  removeAnnotation: (localId: string) => Promise<void>;
  retryAnnotation: (localId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  syncAllPending: () => Promise<void>;
}

const OfflineAnnotationsContext = createContext<OfflineAnnotationsContextValue | null>(null);

export function OfflineAnnotationsProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<OfflineAnnotation[]>([]);
  const [isAnnotationSyncing, setIsAnnotationSyncing] = useState(false);

  useEffect(() => {
    const init = async () => {
      await offlineAnnotationService.initialize();
      setAnnotations(offlineAnnotationService.getAnnotations());
      setIsAnnotationSyncing(offlineAnnotationService.getIsSyncing());
    };
    init();

    const unsubscribe = offlineAnnotationService.subscribe(() => {
      setAnnotations(offlineAnnotationService.getAnnotations());
      setIsAnnotationSyncing(offlineAnnotationService.getIsSyncing());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const addAnnotation = useCallback(async (params: {
    capturedUri: string;
    projectId: string;
    projectName: string;
    originalFileName: string;
  }) => {
    return offlineAnnotationService.addAnnotation(params);
  }, []);

  const removeAnnotation = useCallback(async (localId: string) => {
    return offlineAnnotationService.removeAnnotation(localId);
  }, []);

  const retryAnnotation = useCallback(async (localId: string) => {
    return offlineAnnotationService.retryAnnotation(localId);
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineAnnotationService.clearCompleted();
  }, []);

  const syncAllPending = useCallback(async () => {
    return offlineAnnotationService.syncAllPending();
  }, []);

  const pendingCount = annotations.filter((a) => a.syncState !== "complete").length;

  const value: OfflineAnnotationsContextValue = {
    annotations,
    pendingCount,
    isAnnotationSyncing,
    addAnnotation,
    removeAnnotation,
    retryAnnotation,
    clearCompleted,
    syncAllPending,
  };

  return (
    <OfflineAnnotationsContext.Provider value={value}>
      {children}
    </OfflineAnnotationsContext.Provider>
  );
}

export function useOfflineAnnotations(): OfflineAnnotationsContextValue {
  const context = useContext(OfflineAnnotationsContext);
  if (!context) {
    throw new Error("useOfflineAnnotations must be used within an OfflineAnnotationsProvider");
  }
  return context;
}
