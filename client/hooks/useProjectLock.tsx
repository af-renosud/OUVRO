import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ouvro_locked_project";

type LockedProject = {
  id: string;
  name: string;
};

type ProjectLockContextType = {
  lockedProject: LockedProject | null;
  isLocked: boolean;
  lockProject: (id: string, name: string) => Promise<void>;
  unlockProject: () => Promise<void>;
};

const ProjectLockContext = createContext<ProjectLockContextType | null>(null);

export function ProjectLockProvider({ children }: { children: React.ReactNode }) {
  const [lockedProject, setLockedProject] = useState<LockedProject | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as LockedProject;
          if (parsed.id && parsed.name) {
            setLockedProject(parsed);
          }
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const lockProject = useCallback(async (id: string, name: string) => {
    const value: LockedProject = { id, name };
    setLockedProject(value);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, []);

  const unlockProject = useCallback(async () => {
    setLockedProject(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!loaded) return null;

  return (
    <ProjectLockContext.Provider
      value={{
        lockedProject,
        isLocked: lockedProject !== null,
        lockProject,
        unlockProject,
      }}
    >
      {children}
    </ProjectLockContext.Provider>
  );
}

export function useProjectLock() {
  const context = useContext(ProjectLockContext);
  if (!context) {
    throw new Error("useProjectLock must be used within a ProjectLockProvider");
  }
  return context;
}
