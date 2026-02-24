import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { ThemedText } from "@/components/ThemedText";
import { OuvroScreenHeader } from "@/components/OuvroScreenHeader";
import { useTheme } from "@/hooks/useTheme";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const MAX_RECORDING_SECONDS = 300;

type Priority = "low" | "normal" | "high" | "urgent";
type Classification = "defect" | "action" | "followup" | "general";

type VoiceTaskStep = "record" | "options" | "uploading" | "success" | "error";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#6B7280" },
  { value: "normal", label: "Normal", color: BrandColors.info },
  { value: "high", label: "High", color: BrandColors.warning },
  { value: "urgent", label: "Urgent", color: BrandColors.error },
];

const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: "general", label: "General" },
  { value: "defect", label: "Defect" },
  { value: "action", label: "Action" },
  { value: "followup", label: "Follow-up" },
];

export default function VoiceTaskScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "VoiceTask">>();
  const { projectId, projectName } = route.params;

  const {
    permissionStatus,
    isRecording,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    discardRecording: discardRecorderState,
    requestPermission,
    formatDuration,
  } = useAudioRecorder({ maxDurationSeconds: MAX_RECORDING_SECONDS });

  const { isPlaying, togglePlayback } = useAudioPlayer();

  const [step, setStep] = useState<VoiceTaskStep>("record");
  const [priority, setPriority] = useState<Priority>("normal");
  const [classification, setClassification] = useState<Classification>("general");
  const [uploadProgress, setUploadProgress] = useState("");
  const [resultData, setResultData] = useState<{
    taskId: string;
    transcription: string;
    taskTitle: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const isPhone = width < 500;
  const waveformSize = isPhone ? 100 : 140;
  const buttonSize = isPhone ? 80 : 100;

  const handlePlayPause = () => {
    if (recordingUri) {
      togglePlayback(recordingUri, recordingDuration);
    }
  };

  const handleDiscard = () => {
    discardRecorderState();
    setStep("record");
  };

  const handleProceedToOptions = () => {
    setStep("options");
  };

  const handleSend = async () => {
    if (!recordingUri) return;

    setStep("uploading");
    setUploadProgress("Preparing audio...");

    try {
      let audioBase64 = "";
      let mimeType = "audio/mp4";

      if (Platform.OS !== "web" && recordingUri && !recordingUri.startsWith("mock://")) {
        setUploadProgress("Reading audio file...");
        audioBase64 = await FileSystem.readAsStringAsync(recordingUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (recordingUri.endsWith(".m4a") || recordingUri.endsWith(".mp4")) {
          mimeType = "audio/mp4";
        } else if (recordingUri.endsWith(".mp3")) {
          mimeType = "audio/mpeg";
        }
      } else {
        audioBase64 = "MOCK_WEB_AUDIO_BASE64";
      }

      setUploadProgress("Sending to ArchiDoc...");

      const baseUrl = getApiUrl();
      const url = new URL("/api/voice-task", baseUrl);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audioBase64,
          mimeType,
          project_id: projectId,
          recorded_by: "OUVRO Field User",
          recorded_at: new Date().toISOString(),
          priority,
          classification,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to create voice task");
      }

      setResultData({
        taskId: data.task_id,
        transcription: data.transcription,
        taskTitle: data.task_title,
      });
      setStep("success");
    } catch (error: any) {
      if (__DEV__) console.error("Voice task upload error:", error);
      setErrorMessage(error.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  const handleRetry = () => {
    setErrorMessage("");
    setStep("options");
  };

  if (permissionStatus === "loading") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <Feather name="mic-off" size={64} color={theme.textTertiary} />
          <ThemedText style={styles.permissionText}>Microphone Access Required</ThemedText>
          <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
            Please enable microphone access in your device settings
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BrandColors.primary }]}
            onPress={requestPermission}
          >
            <ThemedText style={styles.primaryButtonText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "uploading") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.accent} />
          <ThemedText style={styles.uploadingText}>{uploadProgress}</ThemedText>
          <ThemedText style={[styles.uploadingSubtext, { color: theme.textSecondary }]}>
            ArchiDoc will transcribe your recording and create a task automatically
          </ThemedText>
        </View>
      </View>
    );
  }

  if (step === "success" && resultData) {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
          ]}
        >
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={64} color={BrandColors.success} />
          </View>
          <ThemedText style={styles.successTitle}>Task Created</ThemedText>
          <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            Your voice task has been sent to ArchiDoc
          </ThemedText>

          <View style={styles.resultCard}>
            <ThemedText style={styles.resultLabel}>Task Title</ThemedText>
            <ThemedText style={styles.resultValue}>{resultData.taskTitle}</ThemedText>
          </View>

          <View style={styles.resultCard}>
            <ThemedText style={styles.resultLabel}>Transcription</ThemedText>
            <ThemedText style={styles.resultTranscription}>{resultData.transcription}</ThemedText>
          </View>

          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Project</ThemedText>
              <ThemedText style={styles.resultValue}>{projectName}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Priority</ThemedText>
              <ThemedText style={styles.resultValue}>{priority}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Classification</ThemedText>
              <ThemedText style={styles.resultValue}>{classification}</ThemedText>
            </View>
          </View>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: BrandColors.primary, marginTop: Spacing.lg }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={styles.primaryButtonText}>Done</ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (step === "error") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={64} color={BrandColors.error} />
          <ThemedText style={styles.errorTitle}>Upload Failed</ThemedText>
          <ThemedText style={[styles.errorMessage, { color: theme.textSecondary }]}>
            {errorMessage}
          </ThemedText>
          <View style={styles.errorButtons}>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: BrandColors.primary }]}
              onPress={handleRetry}
            >
              <ThemedText style={styles.primaryButtonText}>Retry</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (step === "options") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="mic" size={20} color={BrandColors.success} />
            <ThemedText style={styles.sectionTitle}>
              Recording Ready ({formatDuration(recordingDuration)})
            </ThemedText>
          </View>

          <View style={styles.playbackRow}>
            <Pressable
              style={[styles.playBtn, { backgroundColor: BrandColors.primary }]}
              onPress={handlePlayPause}
            >
              <Feather name={isPlaying ? "pause" : "play"} size={20} color="#FFFFFF" />
            </Pressable>
            <ThemedText style={[styles.playbackLabel, { color: theme.textSecondary }]}>
              {isPlaying ? "Playing..." : "Tap to preview"}
            </ThemedText>
          </View>

          <View style={styles.optionSection}>
            <ThemedText style={styles.optionLabel}>Priority</ThemedText>
            <View style={styles.optionChips}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p.value}
                  style={[
                    styles.chip,
                    priority === p.value
                      ? { backgroundColor: p.color, borderColor: p.color }
                      : { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      { color: priority === p.value ? "#FFFFFF" : "#374151" },
                    ]}
                  >
                    {p.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.optionSection}>
            <ThemedText style={styles.optionLabel}>Classification</ThemedText>
            <View style={styles.optionChips}>
              {CLASSIFICATIONS.map((c) => (
                <Pressable
                  key={c.value}
                  style={[
                    styles.chip,
                    classification === c.value
                      ? { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent }
                      : { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
                  ]}
                  onPress={() => setClassification(c.value)}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      { color: classification === c.value ? "#FFFFFF" : "#374151" },
                    ]}
                  >
                    {c.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.projectInfoCard}>
            <Feather name="folder" size={16} color={BrandColors.accent} />
            <ThemedText style={styles.projectInfoText}>{projectName}</ThemedText>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.discardButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleDiscard}
            >
              <Feather name="trash-2" size={18} color={BrandColors.error} />
              <ThemedText style={[styles.discardText, { color: BrandColors.error }]}>Discard</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.sendButton, { backgroundColor: BrandColors.primary }]}
              onPress={handleSend}
            >
              <Feather name="send" size={18} color="#FFFFFF" />
              <ThemedText style={styles.sendText}>Send to ArchiDoc</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OuvroScreenHeader onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
        ]}
      >
        <View style={styles.projectBanner}>
          <Feather name="folder" size={16} color={BrandColors.accent} />
          <ThemedText style={styles.projectBannerText} numberOfLines={1}>
            {projectName}
          </ThemedText>
        </View>

        <View style={styles.waveformContainer}>
          <View
            style={[
              styles.waveformPlaceholder,
              {
                backgroundColor: theme.backgroundSecondary,
                width: waveformSize,
                height: waveformSize,
              },
            ]}
          >
            {isRecording ? (
              <View style={styles.recordingWave}>
                {[...Array(isPhone ? 15 : 20)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: BrandColors.error,
                        height: 20 + Math.random() * (isPhone ? 40 : 60),
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Feather
                name="mic"
                size={isPhone ? 40 : 48}
                color={recordingUri ? BrandColors.success : theme.textTertiary}
              />
            )}
          </View>
          <ThemedText style={[styles.durationText, isPhone && styles.durationTextPhone]}>
            {formatDuration(recordingDuration)}
          </ThemedText>
          {isRecording ? (
            <ThemedText style={styles.maxDurationHint}>
              Max: {formatDuration(MAX_RECORDING_SECONDS)}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.controlsContainer}>
          {!recordingUri ? (
            <Pressable
              style={({ pressed }) => [
                styles.recordButton,
                { width: buttonSize, height: buttonSize },
                isRecording && styles.recordButtonRecording,
                pressed && styles.recordButtonPressed,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
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
                style={[
                  styles.playButton,
                  {
                    backgroundColor: BrandColors.primary,
                    width: isPhone ? 64 : 80,
                    height: isPhone ? 64 : 80,
                  },
                ]}
                onPress={handlePlayPause}
              >
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={isPhone ? 28 : 32}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          )}

          <ThemedText style={[styles.hint, { color: "#6B7280" }]}>
            {isRecording
              ? "Tap to stop recording"
              : recordingUri
              ? "Tap to preview your recording"
              : "Tap to start recording your task"}
          </ThemedText>
        </View>

        {recordingUri ? (
          <View style={[styles.actionButtons, isPhone && styles.actionButtonsPhone]}>
            <Pressable
              style={[
                styles.discardButton,
                { backgroundColor: theme.backgroundSecondary },
                isPhone && styles.actionButtonPhone,
              ]}
              onPress={handleDiscard}
            >
              <Feather name="trash-2" size={20} color={BrandColors.error} />
              <ThemedText style={[styles.discardText, { color: BrandColors.error }]}>
                Discard
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.continueButton,
                { backgroundColor: BrandColors.primary },
                isPhone && styles.actionButtonPhone,
              ]}
              onPress={handleProceedToOptions}
            >
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
              <ThemedText style={styles.continueText}>Continue</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Feather name="info" size={20} color={BrandColors.info} />
          <ThemedText style={styles.infoText}>
            Record your task description (up to 5 minutes). ArchiDoc will automatically transcribe it and create a task in the project.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  projectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: "stretch",
    marginBottom: Spacing.md,
  },
  projectBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: BrandColors.primary,
    flex: 1,
  },
  waveformContainer: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  waveformPlaceholder: {
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
    color: "#0B2545",
  },
  durationTextPhone: {
    fontSize: 36,
  },
  maxDurationHint: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: Spacing.xs,
  },
  controlsContainer: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  recordButton: {
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
    width: "100%",
  },
  actionButtonsPhone: {
    width: "100%",
  },
  actionButtonPhone: {
    flex: 1,
    justifyContent: "center",
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
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
    justifyContent: "center",
  },
  continueText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    backgroundColor: "#F3F4F6",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignSelf: "stretch",
  },
  infoText: {
    ...Typography.bodySmall,
    flex: 1,
    color: "#2D3748",
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
  primaryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    alignSelf: "stretch",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    flex: 1,
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  uploadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0B2545",
    marginTop: Spacing.lg,
  },
  uploadingSubtext: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
  },
  successIcon: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: BrandColors.success,
  },
  successSubtitle: {
    fontSize: 15,
    marginBottom: Spacing.xl,
  },
  resultCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignSelf: "stretch",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  resultTranscription: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: BrandColors.error,
  },
  errorMessage: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 300,
  },
  errorButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
    width: "100%",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "stretch",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  playbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    alignSelf: "stretch",
    marginBottom: Spacing.xl,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playbackLabel: {
    fontSize: 14,
  },
  optionSection: {
    alignSelf: "stretch",
    marginBottom: Spacing.lg,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: Spacing.sm,
  },
  optionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  projectInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: "stretch",
    marginBottom: Spacing.lg,
  },
  projectInfoText: {
    fontSize: 14,
    fontWeight: "500",
    color: BrandColors.primary,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignSelf: "stretch",
    marginTop: Spacing.md,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});
