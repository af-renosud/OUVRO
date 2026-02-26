import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, Alert } from "react-native";
import {
  useAudioRecorder as useExpoAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  AudioModule,
} from "expo-audio";
import type { RecordingStatus } from "expo-audio";

type PermissionStatus = "loading" | "granted" | "denied";

interface UseAudioRecorderOptions {
  maxDurationSeconds?: number;
}

interface UseAudioRecorderReturn {
  permissionStatus: PermissionStatus;
  isRecording: boolean;
  recordingDuration: number;
  recordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => void;
  requestPermission: () => Promise<void>;
  formatDuration: (seconds: number) => string;
}

export function useAudioRecorder(
  options?: UseAudioRecorderOptions
): UseAudioRecorderReturn {
  const maxDuration = options?.maxDurationSeconds;

  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("loading");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCalledRef = useRef(false);

  const handleStatusUpdate = useCallback((status: RecordingStatus) => {
    if (status.isFinished && status.url) {
      setRecordingUri(status.url);
      setIsRecording(false);
    }
    if (status.hasError) {
      if (__DEV__) console.error("Recording error:", status.error);
      setIsRecording(false);
    }
  }, []);

  const recorder = useExpoAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    handleStatusUpdate
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionStatus("granted");
      } catch {
        setPermissionStatus("denied");
      }
    } else {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Permission request timeout")),
            10000
          );
        });
        const permissionPromise = requestRecordingPermissionsAsync();
        const result = await Promise.race([permissionPromise, timeoutPromise]);
        setPermissionStatus(result.granted ? "granted" : "denied");
      } catch {
        setPermissionStatus("denied");
      }
    }
  }, []);

  useEffect(() => {
    requestPermission();
    return () => {
      clearTimer();
    };
  }, []);

  const stopRecording = useCallback(async () => {
    if (stopCalledRef.current) return;
    stopCalledRef.current = true;

    clearTimer();

    if (Platform.OS === "web") {
      setIsRecording(false);
      setRecordingUri("mock://web-recording.m4a");
      stopCalledRef.current = false;
      return;
    }

    try {
      const preState = recorder.getStatus();
      if (!preState.isRecording) {
        setIsRecording(false);
        stopCalledRef.current = false;
        return;
      }

      await recorder.stop();
      const state = recorder.getStatus();
      if (state.url) {
        setRecordingUri(state.url);
      }
      setIsRecording(false);

      await AudioModule.setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } catch (error) {
      if (__DEV__) console.error("Failed to stop recording:", error);
      setIsRecording(false);
    } finally {
      stopCalledRef.current = false;
    }
  }, [clearTimer, recorder]);

  const startRecording = useCallback(async () => {
    stopCalledRef.current = false;

    if (Platform.OS === "web") {
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (maxDuration && d + 1 >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);
      return;
    }

    try {
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (maxDuration && d + 1 >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);
    } catch (error) {
      if (__DEV__) console.error("Failed to start recording:", error);
      Alert.alert(
        "Recording Error",
        "Could not start recording. Please try again."
      );
    }
  }, [maxDuration, stopRecording, clearTimer, recorder]);

  const discardRecording = useCallback(() => {
    setRecordingUri(null);
    setRecordingDuration(0);
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    permissionStatus,
    isRecording,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    discardRecording,
    requestPermission,
    formatDuration,
  };
}
