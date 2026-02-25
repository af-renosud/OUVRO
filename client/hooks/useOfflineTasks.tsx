import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { offlineTaskService, OfflineTask, TaskSyncState } from "@/lib/offline-tasks";
import type { TaskPriority, TaskClassification } from "../../shared/task-sync-types";

interface OfflineTasksContextValue {
  tasks: OfflineTask[];
  pendingCount: number;
  addTask: (params: {
    projectId: string;
    projectName: string;
    audioUri: string;
    audioDuration: number;
    priority?: TaskPriority;
    classification?: TaskClassification;
    recordedAt?: string;
    recordedBy?: string;
  }) => Promise<string>;
  updateTask: (localId: string, updates: Partial<Pick<OfflineTask, "transcription" | "editedTranscription" | "syncState">>) => Promise<void>;
  acceptTask: (localId: string, finalTranscription: string, options?: { priority?: TaskPriority; classification?: TaskClassification }) => Promise<void>;
  removeTask: (localId: string) => Promise<void>;
  retryTask: (localId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  getTask: (localId: string) => OfflineTask | undefined;
  syncTask: (localId: string) => Promise<void>;
  syncAllPending: () => Promise<void>;
}

const OfflineTasksContext = createContext<OfflineTasksContextValue | null>(null);

export function OfflineTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<OfflineTask[]>([]);

  useEffect(() => {
    const init = async () => {
      await offlineTaskService.initialize();
      setTasks(offlineTaskService.getTasks());
    };
    init();

    const unsubscribe = offlineTaskService.subscribe(() => {
      setTasks(offlineTaskService.getTasks());
    });

    return unsubscribe;
  }, []);

  const addTask = useCallback(async (params: {
    projectId: string;
    projectName: string;
    audioUri: string;
    audioDuration: number;
    priority?: TaskPriority;
    classification?: TaskClassification;
    recordedAt?: string;
    recordedBy?: string;
  }) => {
    return offlineTaskService.addTask(params);
  }, []);

  const updateTask = useCallback(async (localId: string, updates: Partial<Pick<OfflineTask, "transcription" | "editedTranscription" | "syncState">>) => {
    return offlineTaskService.updateTask(localId, updates);
  }, []);

  const acceptTask = useCallback(async (localId: string, finalTranscription: string, options?: { priority?: TaskPriority; classification?: TaskClassification }) => {
    return offlineTaskService.acceptTask(localId, finalTranscription, options);
  }, []);

  const removeTask = useCallback(async (localId: string) => {
    return offlineTaskService.removeTask(localId);
  }, []);

  const retryTask = useCallback(async (localId: string) => {
    return offlineTaskService.retryTask(localId);
  }, []);

  const clearCompleted = useCallback(async () => {
    return offlineTaskService.clearCompleted();
  }, []);

  const getTask = useCallback((localId: string) => {
    return offlineTaskService.getTask(localId);
  }, []);

  const syncTask = useCallback(async (localId: string) => {
    return offlineTaskService.syncTask(localId);
  }, []);

  const syncAllPending = useCallback(async () => {
    return offlineTaskService.syncAllPending();
  }, []);

  const pendingCount = tasks.filter((t) => t.syncState !== "complete").length;

  const value: OfflineTasksContextValue = {
    tasks,
    pendingCount,
    addTask,
    updateTask,
    acceptTask,
    removeTask,
    retryTask,
    clearCompleted,
    getTask,
    syncTask,
    syncAllPending,
  };

  return (
    <OfflineTasksContext.Provider value={value}>
      {children}
    </OfflineTasksContext.Provider>
  );
}

export function useOfflineTasks(): OfflineTasksContextValue {
  const context = useContext(OfflineTasksContext);
  if (!context) {
    throw new Error("useOfflineTasks must be used within an OfflineTasksProvider");
  }
  return context;
}
