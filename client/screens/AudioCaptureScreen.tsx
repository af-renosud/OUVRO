import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { CrossPlatformImage } from "@/components/CrossPlatformImage";
import { Audio } from "expo-av";
import { requestRecordingPermissionsAsync } from "expo-audio";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RecordingInstance = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};

export default function AudioCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AudioCapture">>();
  const { projectId } = route.params;

  const [permissionStatus, setPermissionStatus] = useState<"loading" | "granted" | "denied">("loading");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<RecordingInstance | null>(null);

  const isPhone = width < 500;
  const waveformSize = isPhone ? 120 : 160;
  const buttonSize = isPhone ? 96 : 120;

  useEffect(() => {
    checkPermission();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
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
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Permission request timeout")), 10000);
        });
        
        const permissionPromise = requestRecordingPermissionsAsync();
        
        const permissionResponse = await Promise.race([permissionPromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);
        setPermissionStatus(permissionResponse.granted ? "granted" : "denied");
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error("Permission error:", error);
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
        setRecordingDuration((d) => d + 1);
      }, 1000);

      if (__DEV__) console.log("[Audio] Recording started");
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
      setRecordingUri("mock://web-recording.m4a");
      return;
    }

    try {
      if (!recordingRef.current) {
        console.error("[Audio] No recording to stop");
        setIsRecording(false);
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (__DEV__) console.log("[Audio] Recording stopped, URI:", uri);
      
      setIsRecording(false);
      setRecordingUri(uri);
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
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

  const handleDone = () => {
    if (recordingUri) {
      if (__DEV__) console.log("[Audio] Navigating with URI:", recordingUri);
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
      <View style={styles.container}>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <View style={styles.container}>
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
            onPress={checkPermission}
          >
            <ThemedText style={styles.permissionButtonText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
              onPress={handleDiscard}
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
  headerBackground: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
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
