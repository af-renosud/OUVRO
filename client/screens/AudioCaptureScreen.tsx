import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function AudioCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AudioCapture">>();
  const { projectId } = route.params;

  const [permissionStatus, setPermissionStatus] = useState<"loading" | "granted" | "denied">("loading");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<any>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus("granted");
      } catch {
        setPermissionStatus("denied");
      }
    } else {
      try {
        const { useAudioRecorder, AudioModule } = await import("expo-audio");
        const status = await AudioModule.requestRecordingPermissionsAsync();
        setPermissionStatus(status.granted ? "granted" : "denied");
      } catch {
        setPermissionStatus("denied");
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    if (Platform.OS === "web") {
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      return;
    }

    try {
      const { useAudioRecorder, RecordingPresets, AudioModule } = await import("expo-audio");
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (Platform.OS === "web") {
      setIsRecording(false);
      setRecordingUri("mock://web-recording.m4a");
      return;
    }

    try {
      const { AudioModule } = await import("expo-audio");
      setIsRecording(false);
      setRecordingUri("file://recording.m4a");

      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handlePlayPause = async () => {
    if (!recordingUri) return;
    setIsPlaying(!isPlaying);
    
    if (isPlaying) {
      setTimeout(() => setIsPlaying(false), 100);
    } else {
      setTimeout(() => setIsPlaying(false), recordingDuration * 1000);
    }
  };

  const handleDone = () => {
    if (recordingUri) {
      navigation.navigate("ObservationDetails", {
        projectId,
        mediaItems: [{ type: "audio", uri: recordingUri, duration: recordingDuration }],
      });
    }
  };

  const handleDiscard = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
  };

  if (permissionStatus === "loading") {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </ThemedView>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <ThemedView style={styles.permissionContainer}>
        <Feather name="mic-off" size={64} color={theme.textTertiary} />
        <ThemedText style={styles.permissionText}>
          Microphone Access Required
        </ThemedText>
        <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
          Please enable microphone access in your device settings
        </ThemedText>
        <Pressable
          style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
          onPress={checkPermission}
        >
          <ThemedText style={styles.permissionButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.waveformContainer}>
          <View style={[styles.waveformPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            {isRecording ? (
              <View style={styles.recordingWave}>
                {[...Array(20)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: BrandColors.primary,
                        height: 20 + Math.random() * 60,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Feather
                name="mic"
                size={48}
                color={recordingUri ? BrandColors.success : theme.textTertiary}
              />
            )}
          </View>
          <ThemedText style={styles.durationText}>
            {formatDuration(recordingDuration)}
          </ThemedText>
        </View>

        <View style={styles.controlsContainer}>
          {!recordingUri ? (
            <Pressable
              style={({ pressed }) => [
                styles.recordButton,
                isRecording && styles.recordButtonRecording,
                pressed && styles.recordButtonPressed,
              ]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
            >
              <View
                style={[
                  styles.recordInner,
                  isRecording && styles.recordInnerRecording,
                ]}
              />
            </Pressable>
          ) : (
            <View style={styles.playbackControls}>
              <Pressable
                style={[styles.playButton, { backgroundColor: BrandColors.primary }]}
                onPress={handlePlayPause}
              >
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          )}

          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
            {isRecording
              ? "Tap to stop recording"
              : recordingUri
              ? "Tap to play your recording"
              : "Tap to start recording"}
          </ThemedText>
        </View>

        {recordingUri ? (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.discardButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleDiscard}
            >
              <Feather name="trash-2" size={20} color={BrandColors.error} />
              <ThemedText style={[styles.discardText, { color: BrandColors.error }]}>
                Discard
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.doneButton, { backgroundColor: BrandColors.primary }]}
              onPress={handleDone}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <ThemedText style={styles.doneText}>Use Recording</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <Card style={styles.infoCard}>
          <Feather name="info" size={20} color={BrandColors.info} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Your audio will be automatically transcribed to English text. You can then translate it to French before sending to contractors.
          </ThemedText>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  waveformContainer: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  waveformPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  recordingWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: "100%",
    paddingHorizontal: Spacing.md,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  durationText: {
    ...Typography.hero,
    marginTop: Spacing.lg,
    fontVariant: ["tabular-nums"],
  },
  controlsContainer: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  recordButton: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  recordButtonRecording: {
    backgroundColor: "#FEE2E2",
  },
  recordButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  recordInner: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.error,
  },
  recordInnerRecording: {
    borderRadius: BorderRadius.md,
    width: 36,
    height: 36,
  },
  playbackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    ...Typography.bodySmall,
    marginTop: Spacing.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  discardButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  discardText: {
    fontWeight: "600",
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  doneText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  infoText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  permissionSubtext: {
    fontSize: 16,
    textAlign: "center",
  },
  permissionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
