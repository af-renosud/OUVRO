import React from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { OuvroScreenHeader } from "@/components/OuvroScreenHeader";
import { useTheme } from "@/hooks/useTheme";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function AudioCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AudioCapture">>();
  const { projectId, projectName } = route.params;

  const {
    permissionStatus,
    isRecording,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    discardRecording,
    requestPermission,
    formatDuration,
  } = useAudioRecorder();

  const { isPlaying, togglePlayback } = useAudioPlayer();

  const isPhone = width < 500;
  const waveformSize = isPhone ? 120 : 160;
  const buttonSize = isPhone ? 96 : 120;

  const handlePlayPause = () => {
    if (recordingUri) {
      togglePlayback(recordingUri, recordingDuration);
    }
  };

  const handleDone = () => {
    if (recordingUri) {
      navigation.navigate("ObservationDetails", {
        projectId,
        projectName,
        mediaItems: [{ type: "audio", uri: recordingUri, duration: recordingDuration }],
      });
    }
  };

  if (permissionStatus === "loading") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <View style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.permissionContainer}>
          <Feather name="mic-off" size={64} color={theme.textTertiary} />
          <ThemedText style={styles.permissionText}>
            Microphone Access Required
          </ThemedText>
          <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
            Please enable microphone access in your device settings
          </ThemedText>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
            onPress={requestPermission}
          >
            <ThemedText style={styles.permissionButtonText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OuvroScreenHeader onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
        ]}
      >
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
                        backgroundColor: BrandColors.primary,
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
              ? "Tap to play your recording"
              : "Tap to start recording"}
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
              onPress={discardRecording}
            >
              <Feather name="trash-2" size={20} color={BrandColors.error} />
              <ThemedText style={[styles.discardText, { color: BrandColors.error }]}>
                Discard
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.doneButton,
                { backgroundColor: BrandColors.primary },
                isPhone && styles.actionButtonPhone,
              ]}
              onPress={handleDone}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <ThemedText style={styles.doneText}>Use Recording</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Feather name="info" size={20} color={BrandColors.info} />
          <ThemedText style={styles.infoText}>
            Your audio will be automatically transcribed to English text. You can then translate it to French before sending to contractors.
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
    backgroundColor: "#F3F4F6",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  infoText: {
    ...Typography.bodySmall,
    flex: 1,
    color: "#2D3748",
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
