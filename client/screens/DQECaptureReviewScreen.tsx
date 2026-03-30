import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useDQESync } from "@/hooks/useDQESync";

const DQE_AMBER = "#D97706";

const QUALITY_LABELS: Record<string, string> = {
  efficient: "Efficace — 720p H.264",
  standard: "Standard — 1080p HEVC",
  maximum: "Maximum — 4K HEVC",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function DQECaptureReviewScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DQECaptureReview">>();
  const { projectId, projectName, videoUri, videoDuration, qualityTier } = route.params;

  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addCapture } = useDQESync();

  const isLandscapePad = (Platform as { isPad?: boolean }).isPad === true && width > height;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.play();
  });

  const handleDiscard = () => {
    Alert.alert(
      "Abandonner la Capture",
      "Cette vidéo DQE sera supprimée. Êtes-vous sûr ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Abandonner",
          style: "destructive",
          onPress: () => navigation.popToTop(),
        },
      ]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await addCapture({
        projectId,
        projectName,
        videoUri,
        videoDuration,
        qualityTier,
        architectNotes: notes.trim() || undefined,
      });

      Alert.alert(
        "DQE Enregistré",
        "La capture vidéo DQE a été mise en file d'attente. Elle sera transmise à Archidoc dès que la connexion sera disponible.",
        [
          {
            text: "OK",
            onPress: () => navigation.popToTop(),
          },
        ]
      );
    } catch (error: unknown) {
      if (__DEV__) console.error("[DQEReview] Submit error:", error);
      Alert.alert("Erreur", "Impossible de sauvegarder la capture DQE. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const videoSection = (
    <View style={[styles.videoContainer, isLandscapePad && styles.videoContainerLandscape]}>
      <VideoView
        player={player}
        style={styles.videoView}
        contentFit="contain"
        nativeControls
      />
      <View style={styles.videoOverlayBadge}>
        <View style={styles.dqeSmallBadge}>
          <Text style={styles.dqeSmallBadgeText}>DQE</Text>
        </View>
        <Text style={styles.durationBadge}>{formatDuration(videoDuration)}</Text>
      </View>
    </View>
  );

  const infoSection = (
    <KeyboardAwareScrollViewCompat
      style={styles.infoScroll}
      contentContainerStyle={[
        styles.infoContent,
        !isLandscapePad && { paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={16} color={DQE_AMBER} />
          <View style={styles.metaTextGroup}>
            <Text style={styles.metaLabel}>Projet</Text>
            <Text style={styles.metaValue} numberOfLines={2}>{projectName}</Text>
          </View>
        </View>

        <View style={styles.metaDivider} />

        <View style={styles.metaRow}>
          <Feather name="film" size={16} color={DQE_AMBER} />
          <View style={styles.metaTextGroup}>
            <Text style={styles.metaLabel}>Qualité</Text>
            <Text style={styles.metaValue}>{QUALITY_LABELS[qualityTier] || qualityTier}</Text>
          </View>
        </View>
      </View>

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Notes Architecte</Text>
        <Text style={styles.notesHint}>
          Contexte additionnel, localisation précise, référence au lot...
        </Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: Fissure en escalier sur le mur Est, lot 04 maçonnerie, zone B2..."
          placeholderTextColor="rgba(0,0,0,0.35)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={800}
        />
        <Text style={styles.notesCount}>{notes.length}/800</Text>
      </View>

      <View style={styles.submitSection}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Soumettre au DQE</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.discardButton} onPress={handleDiscard} disabled={isSubmitting}>
          <Text style={styles.discardButtonText}>Abandonner</Text>
        </Pressable>
      </View>

      {isLandscapePad ? (
        <View style={{ paddingBottom: insets.bottom + Spacing.xl }} />
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.sm },
        ]}
      >
        <Pressable style={styles.headerBack} onPress={handleDiscard}>
          <Feather name="chevron-left" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <View style={styles.dqeHeaderBadge}>
            <Text style={styles.dqeHeaderBadgeText}>DQE</Text>
          </View>
          <Text style={styles.headerTitle}>Révision de Capture</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLandscapePad ? (
        <View style={styles.landscapeLayout}>
          {videoSection}
          {infoSection}
        </View>
      ) : (
        <>
          {videoSection}
          {infoSection}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1929",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: "#0B1929",
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dqeHeaderBadge: {
    backgroundColor: DQE_AMBER,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  dqeHeaderBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  landscapeLayout: {
    flex: 1,
    flexDirection: "row",
  },
  videoContainer: {
    backgroundColor: "#000000",
    aspectRatio: 16 / 9,
    width: "100%",
    position: "relative",
  },
  videoContainerLandscape: {
    width: "55%",
    aspectRatio: undefined,
    flex: undefined,
    alignSelf: "stretch",
  },
  videoView: {
    flex: 1,
  },
  videoOverlayBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dqeSmallBadge: {
    backgroundColor: "rgba(217,119,6,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  dqeSmallBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  durationBadge: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    fontVariant: ["tabular-nums"],
  },
  infoScroll: {
    flex: 1,
  },
  infoContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  metaCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  metaTextGroup: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  notesSection: {
    gap: Spacing.sm,
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  notesHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
  },
  notesInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    color: "#FFFFFF",
    fontSize: 15,
    padding: Spacing.md,
    minHeight: 100,
    lineHeight: 22,
  },
  notesCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    textAlign: "right",
  },
  submitSection: {
    gap: Spacing.md,
  },
  submitButton: {
    backgroundColor: DQE_AMBER,
    borderRadius: BorderRadius.full,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  discardButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  discardButtonText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 15,
    fontWeight: "500",
  },
});
