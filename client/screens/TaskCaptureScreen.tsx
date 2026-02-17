import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { CrossPlatformImage } from "@/components/CrossPlatformImage";
import { Audio } from "expo-av";
import { requestRecordingPermissionsAsync } from "expo-audio";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useOfflineTasks } from "@/hooks/useOfflineTasks";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RecordingInstance = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};

type TaskStep = "record" | "transcribing" | "review";

export default function TaskCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TaskCapture">>();
  const { projectId, projectName } = route.params;
  const { addTask, acceptTask, updateTask } = useOfflineTasks();

  const [permissionStatus, setPermissionStatus] = useState<"loading" | "granted" | "denied">("loading");
  const [step, setStep] = useState<TaskStep>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [taskLocalId, setTaskLocalId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<RecordingInstance | null>(null);

  const isPhone = width < 500;
  const waveformSize = isPhone ? 100 : 140;
  const buttonSize = isPhone ? 80 : 100;

  useEffect(() => {
    checkPermission();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionStatus("granted");
      } catch {
        setPermissionStatus("denied");
      }
    } else {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Permission request timeout")), 10000);
        });
        const permissionPromise = requestRecordingPermissionsAsync();
        const result = await Promise.race([permissionPromise, timeoutPromise]);
        setPermissionStatus(result.granted ? "granted" : "denied");
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
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (Platform.OS === "web") {
      setIsRecording(false);
      setRecordingUri("mock://web-task-recording.m4a");
      return;
    }

    try {
      if (!recordingRef.current) {
        setIsRecording(false);
        return;
      }
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setIsRecording(false);
      setRecordingUri(uri);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
    }
  };

  const handlePlayPause = async () => {
    if (!recordingUri || Platform.OS === "web") {
      setIsPlaying(!isPlaying);
      if (!isPlaying) {
        setTimeout(() => setIsPlaying(false), recordingDuration * 1000);
      }
      return;
    }

    try {
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
        sound.setOnPlaybackStatusUpdate((status) => {
          if ("isLoaded" in status && status.isLoaded && "didJustFinish" in status && status.didJustFinish) {
            setIsPlaying(false);
            sound.unloadAsync();
          }
        });
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsPlaying(false);
    }
  };

  const handleDiscard = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
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
      await acceptTask(taskLocalId, transcription);

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

  const renderHeader = () => (
    <View style={[styles.headerBackground, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <CrossPlatformImage
            source={require("../../assets/images/back-button.png")}
            style={styles.backButtonImage}
            contentFit="contain"
          />
        </Pressable>
        <CrossPlatformImage
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <View style={styles.backButton} />
      </View>
    </View>
  );

  if (permissionStatus === "loading") {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContainer}>
          <Feather name="mic-off" size={64} color={theme.textTertiary} />
          <ThemedText style={styles.permissionText}>Microphone Access Required</ThemedText>
          <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
            Please enable microphone access in your device settings
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BrandColors.primary }]}
            onPress={checkPermission}
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
        {renderHeader()}
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
        {renderHeader()}
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
      {renderHeader()}
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
  headerBackground: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonImage: {
    width: 28,
    height: 28,
  },
  logo: {
    width: 180,
    height: 56,
  },
  centeredContainer: {
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
  primaryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  stepDotActive: {
    backgroundColor: BrandColors.primary,
  },
  stepDotComplete: {
    backgroundColor: BrandColors.success,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  stepLabel: {
    ...Typography.caption,
    fontWeight: "600",
    width: 80,
    textAlign: "center",
  },
  projectCard: {
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  projectCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  projectCardText: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  recordContent: {
    padding: Spacing.md,
    alignItems: "center",
  },
  waveformContainer: {
    alignItems: "center",
    marginVertical: Spacing.lg,
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
    marginTop: Spacing.md,
    fontVariant: ["tabular-nums"],
    color: "#0B2545",
  },
  durationTextPhone: {
    fontSize: 32,
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
    padding: 5,
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
    width: 32,
    height: 32,
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
    marginTop: Spacing.sm,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    width: "100%",
  },
  errorText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  recordActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginVertical: Spacing.md,
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  discardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  discardButtonText: {
    fontWeight: "600",
  },
  transcribeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  transcribeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: "#F3F4F6",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    width: "100%",
  },
  infoText: {
    ...Typography.bodySmall,
    flex: 1,
    color: "#2D3748",
  },
  transcribingTitle: {
    ...Typography.h2,
    marginTop: Spacing.lg,
  },
  transcribingSubtext: {
    ...Typography.body,
  },
  reviewContent: {
    padding: Spacing.md,
  },
  reviewSection: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  reviewLabel: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  transcriptionInput: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 150,
  },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.sm,
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.md,
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
    ...Typography.label,
    fontWeight: "600",
  },
  audioPreviewDuration: {
    ...Typography.caption,
  },
  reviewActions: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 2,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
