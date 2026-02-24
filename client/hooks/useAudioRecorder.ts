import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { Audio } from "expo-av";
import { requestRecordingPermissionsAsync } from "expo-audio";

type PermissionStatus = "loading" | "granted" | "denied";

type RecordingInstance = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};

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
  const recordingRef = useRef<RecordingInstance | null>(null);
  const stopCalledRef = useRef(false);

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
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
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
      if (!recordingRef.current) {
        setIsRecording(false);
        stopCalledRef.current = false;
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setIsRecording(false);
      setRecordingUri(uri);
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (error) {
      if (__DEV__) console.error("Failed to stop recording:", error);
      setIsRecording(false);
    } finally {
      stopCalledRef.current = false;
    }
  }, [clearTimer]);

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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
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
  }, [maxDuration, stopRecording, clearTimer]);

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
