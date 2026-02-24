import { useState, useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  togglePlayback: (uri: string, durationSeconds: number) => Promise<void>;
  stop: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const webTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(async () => {
    if (webTimeoutRef.current) {
      clearTimeout(webTimeoutRef.current);
      webTimeoutRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (webTimeoutRef.current) {
        clearTimeout(webTimeoutRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  const togglePlayback = useCallback(
    async (uri: string, durationSeconds: number) => {
      if (!uri) return;

      if (isPlaying) {
        await cleanup();
        return;
      }

      if (Platform.OS === "web" || uri.startsWith("mock://")) {
        setIsPlaying(true);
        webTimeoutRef.current = setTimeout(() => {
          setIsPlaying(false);
          webTimeoutRef.current = null;
        }, durationSeconds * 1000);
        return;
      }

      try {
        setIsPlaying(true);
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (
            "isLoaded" in status &&
            status.isLoaded &&
            "didJustFinish" in status &&
            status.didJustFinish
          ) {
            setIsPlaying(false);
            sound.unloadAsync();
            soundRef.current = null;
          }
        });

        await sound.playAsync();
      } catch (error) {
        if (__DEV__) console.error("Playback error:", error);
        setIsPlaying(false);
      }
    },
    [isPlaying, cleanup]
  );

  return {
    isPlaying,
    togglePlayback,
    stop,
  };
}
