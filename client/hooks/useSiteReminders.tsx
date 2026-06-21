import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { offlineRemindersService } from "@/lib/offline-reminders";
import type { SiteReminder } from "@/lib/archidoc-types";

interface SiteRemindersContextValue {
  pendingCount: number;
  isSyncing: boolean;
  /** Reminders for a project, with optimistic toggles applied (from cache). */
  getReminders: (projectId: string) => SiteReminder[];
  getCachedAt: (projectId: string) => string | null;
  hasPendingToggle: (projectId: string, reminderId: string) => boolean;
  hasFailedToggle: (projectId: string, reminderId: string) => boolean;
  /** Re-fetch from ARCHIDOC (BFF). Throws on failure; caller falls back to cache. */
  refreshFromServer: (projectId: string) => Promise<SiteReminder[]>;
  toggleDone: (
    projectId: string,
    reminderId: string,
    isDone: boolean,
  ) => Promise<void>;
  retryToggle: (projectId: string, reminderId: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SiteRemindersContext = createContext<SiteRemindersContextValue | null>(
  null,
);

export function SiteRemindersProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (!mounted) return;
      setIsSyncing(offlineRemindersService.getIsSyncing());
      setPendingCount(offlineRemindersService.getPendingCount());
      setTick((t) => t + 1);
    };

    const init = async () => {
      await offlineRemindersService.initialize();
      sync();
    };
    init();

    const unsubscribe = offlineRemindersService.subscribe(() => sync());

    return () => {
      mounted = false;
      unsubscribe();
      offlineRemindersService.destroy();
    };
  }, []);

  const getReminders = useCallback(
    (projectId: string) => offlineRemindersService.getReminders(projectId),
    [],
  );

  const getCachedAt = useCallback(
    (projectId: string) => offlineRemindersService.getCachedAt(projectId),
    [],
  );

  const hasPendingToggle = useCallback(
    (projectId: string, reminderId: string) =>
      offlineRemindersService.hasPendingToggle(projectId, reminderId),
    [],
  );

  const hasFailedToggle = useCallback(
    (projectId: string, reminderId: string) =>
      offlineRemindersService.hasFailedToggle(projectId, reminderId),
    [],
  );

  const refreshFromServer = useCallback(
    (projectId: string) =>
      offlineRemindersService.refreshFromServer(projectId),
    [],
  );

  const toggleDone = useCallback(
    (projectId: string, reminderId: string, isDone: boolean) =>
      offlineRemindersService.toggleDone(projectId, reminderId, isDone),
    [],
  );

  const retryToggle = useCallback(
    (projectId: string, reminderId: string) =>
      offlineRemindersService.retryToggle(projectId, reminderId),
    [],
  );

  const syncNow = useCallback(
    () => offlineRemindersService.syncAllPending(),
    [],
  );

  return (
    <SiteRemindersContext.Provider
      value={{
        pendingCount,
        isSyncing,
        getReminders,
        getCachedAt,
        hasPendingToggle,
        hasFailedToggle,
        refreshFromServer,
        toggleDone,
        retryToggle,
        syncNow,
      }}
    >
      {children}
    </SiteRemindersContext.Provider>
  );
}

export function useSiteReminders(): SiteRemindersContextValue {
  const ctx = useContext(SiteRemindersContext);
  if (!ctx) {
    throw new Error(
      "useSiteReminders must be used within a SiteRemindersProvider",
    );
  }
  return ctx;
}
