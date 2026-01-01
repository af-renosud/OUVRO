import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function VideoCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "VideoCapture">>();
  const { projectId } = route.params;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPhone = width < 500;
  const buttonSize = isPhone ? 64 : 80;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    if (cameraRef.current) {
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      
      try {
        const video = await cameraRef.current.recordAsync();
        if (video) {
          navigation.navigate("ObservationDetails", {
            projectId,
            mediaItems: [{ type: "video", uri: video.uri, duration: recordingDuration }],
          });
        }
      } catch (error) {
        console.error("Error recording video:", error);
      }
    }
  };

  const handleStopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleClose = () => {
    if (isRecording) {
      handleStopRecording();
    }
    navigation.goBack();
  };

  if (!cameraPermission || !micPermission) {
    return <ThemedView style={styles.container} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    const needsCamera = !cameraPermission.granted;
    const needsMic = !micPermission.granted;

    return (
      <ThemedView style={styles.permissionContainer}>
        <Feather name="video" size={64} color={BrandColors.primary} />
        <ThemedText style={styles.permissionText}>
          {needsCamera && needsMic
            ? "Camera & Microphone Access Required"
            : needsCamera
            ? "Camera Access Required"
            : "Microphone Access Required"}
        </ThemedText>
        <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
          We need these permissions to record site videos
        </ThemedText>
        <Pressable
          style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
          onPress={async () => {
            if (needsCamera) await requestCameraPermission();
            if (needsMic) await requestMicPermission();
          }}
        >
          <ThemedText style={styles.permissionButtonText}>Grant Permission</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <View style={[styles.webPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="video" size={64} color={theme.textTertiary} />
          <ThemedText style={[styles.webText, { color: theme.textSecondary }]}>
            Video recording is available on Expo Go
          </ThemedText>
          <Pressable
            style={[styles.goBackButton, { backgroundColor: BrandColors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={styles.goBackText}>Go Back</ThemedText>
          </Pressable>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        />
      )}

      <View style={[styles.topControls, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Feather name="x" size={28} color="#FFFFFF" />
        </Pressable>
        {isRecording ? (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingTime}>
              {formatDuration(recordingDuration)}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            style={styles.flipButton}
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          >
            <Feather name="refresh-cw" size={24} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.bottomControls,
          {
            paddingBottom: Math.max(insets.bottom, 20) + Spacing.lg,
            backgroundColor: "#000000",
          },
        ]}
      >
        <View style={{ width: isPhone ? 48 : 56 }} />
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
        <View style={{ width: isPhone ? 48 : 56 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  webText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  goBackButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  goBackText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  topControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.error,
  },
  recordingTime: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  recordButton: {
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  recordButtonRecording: {
    backgroundColor: "rgba(255,255,255,0.3)",
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
    borderRadius: BorderRadius.sm,
    width: 32,
    height: 32,
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
