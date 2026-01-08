import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { 
  offlineSyncService, 
  OfflineObservation, 
  SyncProgress, 
  SyncSettings,
  OfflineMedia,
} from "@/lib/offline-sync";

interface OfflineSyncContextValue {
  observations: OfflineObservation[];
  pendingCount: number;
  syncProgress: SyncProgress;
  settings: SyncSettings;
  isNetworkAvailable: boolean;
  isSyncing: boolean;
  addObservation: (obs: Omit<OfflineObservation, "localId" | "syncState" | "retryCount" | "totalMediaSize" | "uploadedMediaSize" | "createdAt" | "modifiedAt">) => Promise<string>;
  updateObservation: (localId: string, updates: Partial<Pick<OfflineObservation, "title" | "description" | "transcription" | "translatedText">>) => Promise<void>;
  removeObservation: (localId: string) => Promise<void>;
  retryObservation: (localId: string) => Promise<void>;
  startSync: () => Promise<void>;
  cancelSync: () => void;
  saveSettings: (settings: Partial<SyncSettings>) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

interface OfflineSyncProviderProps {
  children: ReactNode;
}

export function OfflineSyncProvider({ children }: OfflineSyncProviderProps) {
  const [observations, setObservations] = useState<OfflineObservation[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(offlineSyncService.getSyncProgress());
  const [settings, setSettings] = useState<SyncSettings>(offlineSyncService.getSettings());
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await offlineSyncService.initialize();
      setObservations(offlineSyncService.getObservations());
      setSettings(offlineSyncService.getSettings());
      setIsNetworkAvailable(offlineSyncService.isNetworkAvailable());
      setIsInitialized(true);
    };
    init();

    const unsubscribe = offlineSyncService.subscribe((event, data) => {
      switch (event) {
        case "stateChanged":
          setObservations(offlineSyncService.getObservations());
          setSettings(offlineSyncService.getSettings());
          break;
        case "progressUpdated":
          setSyncProgress(data as SyncProgress);
          setIsSyncing(data.isActive);
          break;
        case "networkChanged":
          setIsNetworkAvailable(data.isConnected && (!offlineSyncService.getSettings().wifiOnly || data.isWifi));
          break;
        case "syncStarted":
          setIsSyncing(true);
          break;
        case "syncCompleted":
        case "syncError":
          setIsSyncing(false);
          setObservations(offlineSyncService.getObservations());
          break;
      }
    });

    return unsubscribe;
  }, []);

  const addObservation = useCallback(async (obs: Omit<OfflineObservation, "localId" | "syncState" | "retryCount" | "totalMediaSize" | "uploadedMediaSize" | "createdAt" | "modifiedAt">) => {
    return offlineSyncService.addObservation(obs);
  }, []);

  const updateObservation = useCallback(async (localId: string, updates: Partial<Pick<OfflineObservation, "title" | "description" | "transcription" | "translatedText">>) => {
    return offlineSyncService.updateObservation(localId, updates);
  }, []);

  const removeObservation = useCallback(async (localId: string) => {
    return offlineSyncService.removeObservation(localId);
  }, []);

  const retryObservation = useCallback(async (localId: string) => {
    return offlineSyncService.retryObservation(localId);
  }, []);

  const startSync = useCallback(async () => {
    return offlineSyncService.startSync();
  }, []);

  const cancelSync = useCallback(() => {
    offlineSyncService.cancelSync();
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<SyncSettings>) => {
    return offlineSyncService.saveSettings(newSettings);
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineSyncService.clearCompleted();
  }, []);

  const pendingCount = observations.filter((obs) => obs.syncState !== "complete").length;

  const value: OfflineSyncContextValue = {
    observations,
    pendingCount,
    syncProgress,
    settings,
    isNetworkAvailable,
    isSyncing,
    addObservation,
    updateObservation,
    removeObservation,
    retryObservation,
    startSync,
    cancelSync,
    saveSettings,
    clearCompleted,
  };

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncContextValue {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider");
  }
  return context;
}

export function createOfflineMedia(
  type: "photo" | "video" | "audio",
  localUri: string,
  fileSize?: number
): OfflineMedia {
  const fileName = localUri.split("/").pop() || `${type}_${Date.now()}`;
  const contentType = type === "photo" ? "image/jpeg" : type === "video" ? "video/mp4" : "audio/m4a";
  
  return {
    id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    localUri,
    fileName,
    contentType,
    fileSize,
    syncState: "pending",
    uploadProgress: 0,
    retryCount: 0,
  };
}
