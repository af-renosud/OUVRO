import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { offlineTaskService, OfflineTask, TaskSyncState } from "@/lib/offline-tasks";

interface OfflineTasksContextValue {
  tasks: OfflineTask[];
  pendingCount: number;
  addTask: (params: {
    projectId: string;
    projectName: string;
    audioUri: string;
    audioDuration: number;
  }) => Promise<string>;
  updateTask: (localId: string, updates: Partial<Pick<OfflineTask, "transcription" | "editedTranscription" | "syncState">>) => Promise<void>;
  acceptTask: (localId: string, finalTranscription: string) => Promise<void>;
  removeTask: (localId: string) => Promise<void>;
  retryTask: (localId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  getTask: (localId: string) => OfflineTask | undefined;
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
  }) => {
    return offlineTaskService.addTask(params);
  }, []);

  const updateTask = useCallback(async (localId: string, updates: Partial<Pick<OfflineTask, "transcription" | "editedTranscription" | "syncState">>) => {
    return offlineTaskService.updateTask(localId, updates);
  }, []);

  const acceptTask = useCallback(async (localId: string, finalTranscription: string) => {
    return offlineTaskService.acceptTask(localId, finalTranscription);
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
