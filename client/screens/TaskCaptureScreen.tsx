import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { OuvroScreenHeader } from "@/components/OuvroScreenHeader";
import { useTheme } from "@/hooks/useTheme";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useOfflineTasks } from "@/hooks/useOfflineTasks";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { TaskPriority, TaskClassification } from "@shared/task-sync-types";

type TaskStep = "record" | "transcribing" | "review";

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#6B7280" },
  { value: "normal", label: "Normal", color: BrandColors.info },
  { value: "high", label: "High", color: BrandColors.warning },
  { value: "urgent", label: "Urgent", color: BrandColors.error },
];

const CLASSIFICATIONS: { value: TaskClassification; label: string }[] = [
  { value: "general", label: "General" },
  { value: "defect", label: "Defect" },
  { value: "action", label: "Action" },
  { value: "followup", label: "Follow-up" },
];

export default function TaskCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TaskCapture">>();
  const { projectId, projectName } = route.params;
  const { addTask, acceptTask, updateTask } = useOfflineTasks();

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
  } = useAudioRecorder();

  const { isPlaying, togglePlayback } = useAudioPlayer();

  const [step, setStep] = useState<TaskStep>("record");
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [taskLocalId, setTaskLocalId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [classification, setClassification] = useState<TaskClassification>("general");

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
    setTranscription("");
    setTranscribeError(null);
    setStep("record");
  };

  const handleTranscribe = async () => {
    if (!recordingUri) return;

    setStep("transcribing");
    setIsTranscribing(true);
    setTranscribeError(null);

    const localId = await addTask({
      projectId,
      projectName,
      audioUri: recordingUri,
      audioDuration: recordingDuration,
      priority,
      classification,
      recordedAt: new Date().toISOString(),
      recordedBy: "OUVRO Field User",
    });
    setTaskLocalId(localId);

    try {
      if (Platform.OS === "web" || recordingUri.startsWith("mock://")) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const mockText = "This is a placeholder transcription. On a real device, your audio will be transcribed by AI.";
        setTranscription(mockText);
        await updateTask(localId, { transcription: mockText, syncState: "review" });
        setStep("review");
        setIsTranscribing(false);
        return;
      }

      const response = await fetch(recordingUri);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];

        try {
          const res = await apiRequest("POST", "/api/transcribe", {
            audioBase64: base64,
            mimeType: "audio/mp4",
          });
          const result = await res.json();
          if (result.error) throw new Error(result.error);

          setTranscription(result.transcription);
          await updateTask(localId, { transcription: result.transcription, syncState: "review" });
          setStep("review");
        } catch (error: any) {
          setTranscribeError(error?.message || "Transcription failed");
          setStep("record");
        } finally {
          setIsTranscribing(false);
        }
      };

      reader.onerror = () => {
        setTranscribeError("Failed to read audio file");
        setIsTranscribing(false);
        setStep("record");
      };

      reader.readAsDataURL(blob);
    } catch (error: any) {
      setTranscribeError(error?.message || "Failed to process audio");
      setIsTranscribing(false);
      setStep("record");
    }
  };

  const handleAcceptTask = async () => {
    if (!taskLocalId) return;

    setIsSaving(true);
    try {
      await acceptTask(taskLocalId, transcription, { priority, classification });

      if (navigation.canGoBack()) {
        navigation.popToTop();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save task. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryTranscription = () => {
    setTranscribeError(null);
    handleTranscribe();
  };

  if (permissionStatus === "loading") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centeredContainer}>
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

  if (step === "transcribing") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <ThemedText style={styles.transcribingTitle}>Transcribing your task...</ThemedText>
          <ThemedText style={[styles.transcribingSubtext, { color: theme.textSecondary }]}>
            AI is converting your audio to text
          </ThemedText>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotComplete]} />
            <View style={[styles.stepLine, styles.stepLineActive]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
          <View style={styles.stepLabels}>
            <ThemedText style={[styles.stepLabel, { color: BrandColors.success }]}>Record</ThemedText>
            <ThemedText style={[styles.stepLabel, { color: BrandColors.primary }]}>Transcribe</ThemedText>
            <ThemedText style={[styles.stepLabel, { color: theme.textTertiary }]}>Review</ThemedText>
          </View>
        </View>
      </View>
    );
  }

  if (step === "review") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.reviewContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotComplete]} />
            <View style={[styles.stepLine, styles.stepLineComplete]} />
            <View style={[styles.stepDot, styles.stepDotComplete]} />
            <View style={[styles.stepLine, styles.stepLineActive]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
          <View style={styles.stepLabels}>
            <ThemedText style={[styles.stepLabel, { color: BrandColors.success }]}>Record</ThemedText>
            <ThemedText style={[styles.stepLabel, { color: BrandColors.success }]}>Transcribe</ThemedText>
            <ThemedText style={[styles.stepLabel, { color: BrandColors.primary }]}>Review</ThemedText>
          </View>

          <Card style={styles.projectCard}>
            <View style={styles.projectCardRow}>
              <Feather name="folder" size={18} color={BrandColors.accent} />
              <ThemedText style={styles.projectCardText}>{projectName}</ThemedText>
            </View>
          </Card>

          <View style={styles.audioPreview}>
            <Pressable
              style={[styles.miniPlayButton, { backgroundColor: BrandColors.primary }]}
              onPress={handlePlayPause}
            >
              <Feather name={isPlaying ? "pause" : "play"} size={18} color="#FFFFFF" />
            </Pressable>
            <View style={styles.audioPreviewInfo}>
              <ThemedText style={styles.audioPreviewLabel}>Audio Recording</ThemedText>
              <ThemedText style={[styles.audioPreviewDuration, { color: theme.textSecondary }]}>
                {formatDuration(recordingDuration)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.reviewSection}>
            <ThemedText style={styles.reviewLabel}>Task Description (edit if needed)</ThemedText>
            <TextInput
              style={[
                styles.transcriptionInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={transcription}
              onChangeText={setTranscription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Edit the transcription here..."
              placeholderTextColor={theme.textTertiary}
            />
          </View>

          <View style={styles.chipSection}>
            <ThemedText style={styles.chipSectionLabel}>Priority</ThemedText>
            <View style={styles.chipRow}>
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

          <View style={styles.chipSection}>
            <ThemedText style={styles.chipSectionLabel}>Classification</ThemedText>
            <View style={styles.chipRow}>
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

          <View style={styles.reviewActions}>
            <Pressable
              style={[styles.discardButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                Alert.alert("Discard Task", "Are you sure you want to discard this task?", [
                  { text: "Keep", style: "cancel" },
                  { text: "Discard", style: "destructive", onPress: handleDiscard },
                ]);
              }}
            >
              <Feather name="trash-2" size={18} color={BrandColors.error} />
              <ThemedText style={[styles.discardButtonText, { color: BrandColors.error }]}>
                Discard
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.acceptButton,
                { backgroundColor: BrandColors.primary },
                isSaving && styles.buttonDisabled,
              ]}
              onPress={handleAcceptTask}
              disabled={isSaving || !transcription.trim()}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.acceptButtonText}>Accept Task</ThemedText>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Feather name="info" size={18} color={BrandColors.info} />
            <ThemedText style={styles.infoText}>
              Review and edit the transcription above. Once accepted, this task will be saved to your queue and synced to ARCHIDOC when connected.
            </ThemedText>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OuvroScreenHeader onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.recordContent,
          { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
        ]}
      >
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
        <View style={styles.stepLabels}>
          <ThemedText style={[styles.stepLabel, { color: BrandColors.primary }]}>Record</ThemedText>
          <ThemedText style={[styles.stepLabel, { color: theme.textTertiary }]}>Transcribe</ThemedText>
          <ThemedText style={[styles.stepLabel, { color: theme.textTertiary }]}>Review</ThemedText>
        </View>

        <Card style={styles.projectCard}>
          <View style={styles.projectCardRow}>
            <Feather name="folder" size={18} color={BrandColors.accent} />
            <ThemedText style={styles.projectCardText}>{projectName}</ThemedText>
          </View>
        </Card>

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
                {[...Array(isPhone ? 12 : 18)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: BrandColors.primary,
                        height: 15 + Math.random() * (isPhone ? 35 : 50),
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Feather
                name="clipboard"
                size={isPhone ? 36 : 44}
                color={recordingUri ? BrandColors.success : theme.textTertiary}
              />
            )}
          </View>
          <ThemedText style={[styles.durationText, isPhone && styles.durationTextPhone]}>
            {formatDuration(recordingDuration)}
          </ThemedText>
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
                    width: isPhone ? 56 : 72,
                    height: isPhone ? 56 : 72,
                  },
                ]}
                onPress={handlePlayPause}
              >
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={isPhone ? 24 : 28}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          )}

          <ThemedText style={[styles.hint, { color: "#6B7280" }]}>
            {isRecording
              ? "Describe your task, then tap to stop"
              : recordingUri
              ? "Tap play to review, then transcribe"
              : "Tap to record your task description"}
          </ThemedText>
        </View>

        {transcribeError ? (
          <View style={[styles.errorBanner, { backgroundColor: `${BrandColors.error}15` }]}>
            <Feather name="alert-circle" size={18} color={BrandColors.error} />
            <ThemedText style={[styles.errorText, { color: BrandColors.error }]}>
              {transcribeError}
            </ThemedText>
          </View>
        ) : null}

        {recordingUri ? (
          <View style={styles.recordActions}>
            <Pressable
              style={[styles.discardButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleDiscard}
            >
              <Feather name="trash-2" size={18} color={BrandColors.error} />
              <ThemedText style={[styles.discardButtonText, { color: BrandColors.error }]}>
                Re-record
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.transcribeButton, { backgroundColor: BrandColors.primary }]}
              onPress={transcribeError ? handleRetryTranscription : handleTranscribe}
            >
              <Feather name="cpu" size={18} color="#FFFFFF" />
              <ThemedText style={styles.transcribeButtonText}>
                {transcribeError ? "Retry Transcribe" : "Transcribe"}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Feather name="info" size={18} color={BrandColors.info} />
          <ThemedText style={styles.infoText}>
            Describe your task aloud. OUVRO will transcribe it using AI, and you can review and edit before accepting.
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
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  recordContent: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  reviewContent: {
    padding: Spacing.lg,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  stepDotActive: {
    backgroundColor: BrandColors.primary,
  },
  stepDotComplete: {
    backgroundColor: BrandColors.success,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: Spacing.xs,
  },
  stepLineActive: {
    backgroundColor: BrandColors.primary,
  },
  stepLineComplete: {
    backgroundColor: BrandColors.success,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
    marginBottom: Spacing.lg,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  projectCard: {
    marginBottom: Spacing.lg,
  },
  projectCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  projectCardText: {
    fontSize: 15,
    fontWeight: "600",
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
    gap: 3,
    height: "100%",
    paddingHorizontal: Spacing.sm,
  },
  waveBar: {
    width: 3,
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
  controlsContainer: {
    alignItems: "center",
    marginVertical: Spacing.lg,
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignSelf: "stretch",
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  recordActions: {
    flexDirection: "row",
    gap: Spacing.md,
    alignSelf: "stretch",
    marginTop: Spacing.md,
  },
  discardButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  discardButtonText: {
    fontWeight: "600",
  },
  transcribeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
    justifyContent: "center",
  },
  transcribeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "#F3F4F6",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  miniPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  audioPreviewInfo: {
    flex: 1,
  },
  audioPreviewLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  audioPreviewDuration: {
    fontSize: 13,
  },
  reviewSection: {
    marginBottom: Spacing.lg,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: Spacing.sm,
  },
  transcriptionInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 140,
    lineHeight: 22,
  },
  reviewActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    backgroundColor: "#F3F4F6",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
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
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  transcribingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0B2545",
    marginTop: Spacing.lg,
  },
  transcribingSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  chipSection: {
    marginBottom: Spacing.lg,
  },
  chipSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
