import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Text,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import type { CameraRecordingOptions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { DQEQualityTier } from "@/lib/archidoc-types";

const DQE_QUALITY_STORAGE_KEY = "ouvro_dqe_quality_tier";

const DQE_AMBER = "#D97706";

type QualityConfig = {
  tier: DQEQualityTier;
  label: string;
  sublabel: string;
  videoQuality: "720p" | "1080p" | "2160p";
  videoBitrate: number;
  codec: "avc1" | "hvc1";
  ipadOnly: boolean;
};

// DQE video quality tiers. Source of truth — these specs are NOT
// mirrored in `replit.md`. Codec / bitrate trade-offs:
//   efficient — 720p H.264 @ 4 Mbps. Smallest files, widest device
//               compatibility. Default on iPhone.
//   standard  — 1080p HEVC @ 8 Mbps. Best balance of quality vs file
//               size; HEVC needs iOS 11+ / modern Android.
//   maximum   — 4K HEVC @ 16 Mbps. iPad-only — large sensor + sustained
//               write bandwidth required to avoid frame drops.
// If you change a bitrate or codec, double-check the corresponding
// QUALITY_LABELS in `DQECaptureReviewScreen.tsx` so the user-visible
// metadata stays in sync.
const QUALITY_CONFIGS: QualityConfig[] = [
  {
    tier: "efficient",
    label: "Efficace",
    sublabel: "720p H.264",
    videoQuality: "720p",
    videoBitrate: 4_000_000,
    codec: "avc1",
    ipadOnly: false,
  },
  {
    tier: "standard",
    label: "Standard",
    sublabel: "1080p HEVC",
    videoQuality: "1080p",
    videoBitrate: 8_000_000,
    codec: "hvc1",
    ipadOnly: false,
  },
  {
    tier: "maximum",
    label: "Maximum",
    sublabel: "4K HEVC",
    videoQuality: "2160p",
    videoBitrate: 16_000_000,
    codec: "hvc1",
    ipadOnly: true,
  },
];

// Hard cap on a single DQE narration (3 minutes). Architects asked for
// this — longer narrations should be split into multiple captures so
// the upload queue can make progress on poor signal.
const MAX_DURATION_SECONDS = 180;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function isUltraWideLens(name: string): boolean {
  const l = name.toLowerCase();
  return l.includes("ultra");
}

function isWideLens(name: string): boolean {
  const l = name.toLowerCase();
  return l.includes("wide") && !l.includes("ultra");
}


export default function DQECaptureScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DQECapture">>();
  const { projectId, projectName } = route.params;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [qualityTier, setQualityTier] = useState<DQEQualityTier>("standard");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [wideLens, setWideLens] = useState<string | undefined>(undefined);
  const [ultraWideLens, setUltraWideLens] = useState<string | undefined>(undefined);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [cameraKey, setCameraKey] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const isPad = (Platform as { isPad?: boolean }).isPad === true;
  const availableConfigs = QUALITY_CONFIGS.filter(
    (q) => !q.ipadOnly || isPad
  );
  const currentConfig = availableConfigs.find((q) => q.tier === qualityTier) || availableConfigs[1] || availableConfigs[0];

  useEffect(() => {
    AsyncStorage.getItem(DQE_QUALITY_STORAGE_KEY).then((stored) => {
      if (stored === "efficient" || stored === "standard" || (stored === "maximum" && isPad)) {
        setQualityTier(stored);
      }
    }).catch(() => {});
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleCameraReady = () => {
    if (Platform.OS === "ios") {
      cameraRef.current
        ?.getAvailableLensesAsync?.()
        .then((lenses) => {
          if (!lenses) return;
          const wide = lenses.find(isWideLens);
          const ultraWide = lenses.find(isUltraWideLens);
          setWideLens(wide);
          setUltraWideLens(ultraWide);
          setSelectedLens(wide ?? ultraWide);
        })
        .catch(() => {});
    }
  };

  const handleChangeQuality = (tier: DQEQualityTier) => {
    if (isRecording) return;
    setQualityTier(tier);
    setCameraKey((k) => k + 1);
    AsyncStorage.setItem(DQE_QUALITY_STORAGE_KEY, tier).catch(() => {});
  };

  const canToggleLens = wideLens !== undefined && ultraWideLens !== undefined;

  const handleToggleLens = () => {
    if (!canToggleLens || isRecording) return;
    setSelectedLens((cur) => (cur === wideLens ? ultraWideLens : wideLens));
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    setIsRecording(true);
    setRecordingDuration(0);
    durationRef.current = 0;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setRecordingDuration((d) => d + 1);
    }, 1000);

    try {
      const recordOptions: CameraRecordingOptions = {
        maxDuration: MAX_DURATION_SECONDS,
        ...(Platform.OS === "ios" ? { codec: currentConfig.codec } : {}),
      };

      const video = await cameraRef.current.recordAsync(recordOptions);

      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      if (video?.uri) {
        navigation.replace("DQECaptureReview", {
          projectId,
          projectName,
          videoUri: video.uri,
          videoDuration: durationRef.current,
          qualityTier: currentConfig.tier,
        });
      }
    } catch (error) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      if (__DEV__) console.error("[DQECapture] Recording error:", error);
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    cameraRef.current?.stopRecording();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleRecordPress = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  if (!cameraPermission) {
    return <View style={styles.permissionContainer} />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Accès Caméra Requis</Text>
        <Text style={styles.permissionSubtitle}>
          L'enregistrement vidéo DQE nécessite l'accès à la caméra et au microphone.
        </Text>
        {cameraPermission.status === "denied" && !cameraPermission.canAskAgain ? null : (
          <Pressable
            style={styles.permissionButton}
            onPress={async () => {
              await requestCameraPermission();
              if (!micPermission?.granted) await requestMicPermission();
            }}
          >
            <Text style={styles.permissionButtonText}>Activer la Caméra</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!micPermission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Accès Microphone Requis</Text>
        <Text style={styles.permissionSubtitle}>
          L'enregistrement vidéo DQE nécessite l'accès au microphone pour la narration vocale.
        </Text>
        {micPermission?.status === "denied" && !micPermission?.canAskAgain ? null : (
          <Pressable style={styles.permissionButton} onPress={requestMicPermission}>
            <Text style={styles.permissionButtonText}>Activer le Microphone</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const progressFraction = recordingDuration / MAX_DURATION_SECONDS;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        key={cameraKey}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        videoQuality={currentConfig.videoQuality}
        videoBitrate={currentConfig.videoBitrate}
        enableTorch={torchEnabled}
        selectedLens={selectedLens}
        videoStabilizationMode={Platform.OS === "ios" ? "auto" : undefined}
        autofocus={Platform.OS === "ios" ? "on" : undefined}
        onCameraReady={handleCameraReady}
      />

      {isRecording ? (
        <View style={[styles.progressBar, { top: 0 }]}>
          <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.dqeBadge}>
          <View style={styles.dqeDot} />
          <Text style={styles.dqeBadgeText}>DQE</Text>
        </View>

        <View style={styles.qualitySelector}>
          {availableConfigs.map((config) => (
            <Pressable
              key={config.tier}
              style={[
                styles.qualityPill,
                qualityTier === config.tier && styles.qualityPillActive,
                isRecording && styles.qualityPillDisabled,
              ]}
              onPress={() => handleChangeQuality(config.tier)}
              disabled={isRecording}
            >
              <Text
                style={[
                  styles.qualityPillText,
                  qualityTier === config.tier && styles.qualityPillTextActive,
                ]}
              >
                {config.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.sideControls, { right: insets.right + Spacing.md, bottom: 140 + insets.bottom }]}>
        <Pressable
          style={[styles.sideButton, torchEnabled && styles.sideButtonActive]}
          onPress={() => setTorchEnabled((t) => !t)}
        >
          <Feather name={torchEnabled ? "zap" : "zap-off"} size={22} color="#FFFFFF" />
        </Pressable>

        {canToggleLens ? (
          <Pressable
            style={[styles.sideButton, isRecording && styles.sideButtonDisabled]}
            onPress={handleToggleLens}
            disabled={isRecording}
          >
            <Text style={styles.lensLabel}>
              {selectedLens && isUltraWideLens(selectedLens) ? ".5x" : "1x"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.projectBadge}>
          <Feather name="map-pin" size={12} color={DQE_AMBER} />
          <Text style={styles.projectBadgeText} numberOfLines={1}>
            {projectName}
          </Text>
        </View>

        <View style={styles.recordRow}>
          <View style={styles.timerContainer}>
            {isRecording ? (
              <>
                <View style={styles.recordingDot} />
                <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.timerRemaining}>/{formatDuration(MAX_DURATION_SECONDS)}</Text>
              </>
            ) : (
              <Text style={styles.timerHint}>Max {formatDuration(MAX_DURATION_SECONDS)}</Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              pressed && styles.recordButtonPressed,
            ]}
            onPress={handleRecordPress}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={styles.recordIcon} />
            )}
          </Pressable>

          <View style={styles.qualityInfo}>
            <Text style={styles.qualityInfoText}>{currentConfig.sublabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#0B1929",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  permissionSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    backgroundColor: DQE_AMBER,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  progressBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    zIndex: 20,
  },
  progressFill: {
    height: 3,
    backgroundColor: DQE_AMBER,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dqeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: DQE_AMBER,
  },
  dqeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DQE_AMBER,
  },
  dqeBadgeText: {
    color: DQE_AMBER,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  qualitySelector: {
    flexDirection: "row",
    gap: 6,
  },
  qualityPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  qualityPillActive: {
    backgroundColor: DQE_AMBER,
    borderColor: DQE_AMBER,
  },
  qualityPillDisabled: {
    opacity: 0.4,
  },
  qualityPillText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  qualityPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sideControls: {
    position: "absolute",
    flexDirection: "column",
    gap: Spacing.md,
    zIndex: 10,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtonActive: {
    backgroundColor: "rgba(217,119,6,0.6)",
    borderColor: DQE_AMBER,
  },
  sideButtonDisabled: {
    opacity: 0.4,
  },
  lensLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  projectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  projectBadgeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 260,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timerRemaining: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  timerHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: DQE_AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    borderColor: "#EF4444",
  },
  recordButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  recordIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: DQE_AMBER,
  },
  stopIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  qualityInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  qualityInfoText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
  },
});
