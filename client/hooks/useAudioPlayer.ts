import { useState, useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import {
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  togglePlayback: (uri: string, durationSeconds: number) => Promise<void>;
  stop: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const webTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUriRef = useRef<string | null>(null);

  const player = useExpoAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!status.playing && isPlaying && currentUriRef.current && Platform.OS !== "web") {
      if (status.currentTime > 0 && status.duration > 0 && status.currentTime >= status.duration - 0.5) {
        setIsPlaying(false);
      }
    }
  }, [status.playing, status.currentTime, status.duration, isPlaying]);

  useEffect(() => {
    return () => {
      if (webTimeoutRef.current) {
        clearTimeout(webTimeoutRef.current);
      }
    };
  }, []);

  const stop = useCallback(async () => {
    if (webTimeoutRef.current) {
      clearTimeout(webTimeoutRef.current);
      webTimeoutRef.current = null;
    }
    try {
      player.pause();
    } catch {}
    setIsPlaying(false);
  }, [player]);

  const togglePlayback = useCallback(
    async (uri: string, durationSeconds: number) => {
      if (!uri) return;

      if (isPlaying) {
        await stop();
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
        if (currentUriRef.current !== uri) {
          player.replace(uri);
          currentUriRef.current = uri;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        setIsPlaying(true);
        player.seekTo(0);
        player.play();
      } catch (error) {
        if (__DEV__) console.error("Playback error:", error);
        setIsPlaying(false);
      }
    },
    [isPlaying, stop, player]
  );

  return {
    isPlaying,
    togglePlayback,
    stop,
  };
}
