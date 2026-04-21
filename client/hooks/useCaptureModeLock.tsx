import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SnagType } from "@/lib/archidoc-types";

const STORAGE_KEY = "ouvro_capture_mode";

type CaptureModeContextType = {
  mode: SnagType | null;
  isSnagMode: boolean;
  lockMode: (mode: SnagType) => Promise<void>;
  unlockMode: () => Promise<void>;
};

const CaptureModeLockContext = createContext<CaptureModeContextType | null>(null);

export function CaptureModeLockProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<SnagType | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "defaut" || raw === "reserve") {
        setMode(raw);
      }
      setLoaded(true);
    });
  }, []);

  const lockMode = useCallback(async (next: SnagType) => {
    setMode(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const unlockMode = useCallback(async () => {
    setMode(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!loaded) return null;

  return (
    <CaptureModeLockContext.Provider
      value={{
        mode,
        isSnagMode: mode !== null,
        lockMode,
        unlockMode,
      }}
    >
      {children}
    </CaptureModeLockContext.Provider>
  );
}

export function useCaptureModeLock() {
  const ctx = useContext(CaptureModeLockContext);
  if (!ctx) {
    throw new Error("useCaptureModeLock must be used within a CaptureModeLockProvider");
  }
  return ctx;
}
