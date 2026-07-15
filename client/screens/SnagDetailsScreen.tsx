import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  Image,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { OuvroScreenHeader } from "@/components/OuvroScreenHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { useCaptureModeLock } from "@/hooks/useCaptureModeLock";
import { useSnagSync } from "@/hooks/useSnagSync";
import { DictationButton } from "@/components/DictationButton";
import { type ProjectFile } from "@/lib/archidoc-api";
import {
  getContractorsOfflineFirst,
  type ContractorListResult,
} from "@/lib/offline-contractors";
import type { SnagSeverity, Contractor } from "@/lib/archidoc-types";
import type { RootStackParamList, MediaItem } from "@/navigation/RootStackNavigator";

const SEVERITY_OPTIONS: { value: SnagSeverity; label: string }[] = [
  { value: "minor", label: "Mineur" },
  { value: "major", label: "Majeur" },
  { value: "critical", label: "Critique" },
];

function mediaToMime(item: MediaItem): string {
  if (item.type === "photo") return "image/jpeg";
  if (item.type === "video") return "video/mp4";
  return "audio/m4a";
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SnagDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SnagDetails">>();
  const { projectId, projectName, mediaItems } = route.params;

  const { mode, unlockMode } = useCaptureModeLock();
  const { addCapture } = useSnagSync();

  const {
    data: contractorsResult,
    isLoading: contractorsLoading,
    isError: contractorsError,
  } = useQuery<ContractorListResult>({
    queryKey: ["archidoc-contractors"],
    queryFn: getContractorsOfflineFirst,
    staleTime: 1000 * 60 * 10,
  });

  const contractors = contractorsResult?.contractors ?? [];
  const contractorsFromCache = contractorsResult?.fromCache ?? false;

  const sortedContractors = useMemo(
    () => [...contractors].sort((a, b) => a.name.localeCompare(b.name)),
    [contractors]
  );

  const [media, setMedia] = useState<MediaItem[]>(mediaItems);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SnagSeverity | undefined>(undefined);
  const [contractorId, setContractorId] = useState<string | undefined>(undefined);
  const [contractorName, setContractorName] = useState("");
  const [location, setLocation] = useState("");
  const [showContractorPicker, setShowContractorPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const annotatedMedia = route.params.annotatedMedia;
  useEffect(() => {
    if (!annotatedMedia) return;
    setMedia((prev) =>
      prev.map((m, i) =>
        i === annotatedMedia.index ? { ...m, uri: annotatedMedia.uri } : m
      )
    );
    navigation.setParams({ annotatedMedia: undefined });
  }, [annotatedMedia, navigation]);

  const handleAnnotatePhoto = useCallback(
    (item: MediaItem, index: number) => {
      const file: ProjectFile = {
        objectId: `local-snag-photo-${index}`,
        objectName: `snag-photo-${index}.jpg`,
        originalName: `Photo ${index + 1}`,
        contentType: "image/jpeg",
        size: 0,
        projectId,
        category: "photos",
        createdAt: new Date().toISOString(),
      };
      navigation.navigate("Annotation", {
        file,
        signedUrl: item.uri,
        projectId,
        projectName: projectName || "Unknown Project",
        returnScreen: "SnagDetails",
        mediaIndex: index,
      });
    },
    [navigation, projectId, projectName]
  );

  if (!mode) {
    return (
      <ThemedView style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <ThemedText>No active capture mode</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!mediaItems || mediaItems.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <OuvroScreenHeader onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <ThemedText>No media captured</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const modeLabel = mode === "defaut" ? "Défaut" : "Réserve";

  const pickContractor = (entry: Contractor | null) => {
    if (entry) {
      setContractorId(entry.id);
      setContractorName(entry.name);
    } else {
      setContractorId(undefined);
    }
    setShowContractorPicker(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const mediaPayload = media.map((m) => ({
        type: m.type,
        uri: m.uri,
        mimeType: mediaToMime(m),
        durationSeconds: m.duration,
      }));
      const finalContractorName = contractorName.trim() || undefined;
      const finalTitle = title.trim() || "Sans titre";
      await addCapture({
        projectId,
        projectName: projectName || "Unknown Project",
        type: mode,
        title: finalTitle,
        description: description.trim() || undefined,
        severity,
        contractorId,
        contractorName: finalContractorName,
        location: location.trim() || undefined,
        media: mediaPayload,
      });
      navigation.popToTop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save snag";
      Alert.alert("Erreur", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExitMode = () => {
    Alert.alert(
      "Quitter le mode capture",
      `Désactiver le mode ${modeLabel} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            await unlockMode();
            navigation.popToTop();
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <OuvroScreenHeader onBack={() => navigation.goBack()} />
      <KeyboardAwareScrollViewCompat
        bottomOffset={Spacing.xl}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 20) + Spacing.xl },
        ]}
      >
        <View
          style={[
            styles.modeBanner,
            { backgroundColor: mode === "defaut" ? "#FEE2E2" : "#FEF3C7" },
          ]}
        >
          <Feather
            name={mode === "defaut" ? "alert-triangle" : "flag"}
            size={18}
            color={mode === "defaut" ? "#B91C1C" : "#92400E"}
          />
          <ThemedText
            style={[
              styles.modeBannerText,
              { color: mode === "defaut" ? "#B91C1C" : "#92400E" },
            ]}
          >
            Mode {modeLabel} actif
          </ThemedText>
          <Pressable onPress={handleExitMode} style={styles.modeExitBtn}>
            <ThemedText style={styles.modeExitText}>Quitter</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.sectionTitle}>
          {media.length} média{media.length > 1 ? "s" : ""} capturé{media.length > 1 ? "s" : ""}
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaPreviewRow}
        >
          {media.map((m, i) => {
            const isPhoto = m.type === "photo";
            const inner = (
              <>
                {m.type === "photo" || m.type === "video" ? (
                  <Image source={{ uri: m.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
                ) : (
                  <View style={styles.audioPreviewBox}>
                    <Feather name="mic" size={28} color={BrandColors.primary} />
                  </View>
                )}
                {m.type === "video" ? (
                  <View style={styles.mediaOverlay}>
                    <Feather name="play-circle" size={22} color="#FFFFFF" />
                    {m.duration ? (
                      <ThemedText style={styles.mediaOverlayText}>{formatDuration(m.duration)}</ThemedText>
                    ) : null}
                  </View>
                ) : null}
                {m.type === "audio" && m.duration ? (
                  <ThemedText style={[styles.audioDuration, { color: theme.textSecondary }]}>
                    {formatDuration(m.duration)}
                  </ThemedText>
                ) : null}
                {isPhoto ? (
                  <View style={styles.annotateBadge}>
                    <Feather name="edit-2" size={11} color="#FFFFFF" />
                    <ThemedText style={styles.annotateBadgeText}>Annoter</ThemedText>
                  </View>
                ) : null}
              </>
            );
            const previewStyle = [
              styles.mediaPreview,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
            ];
            return isPhoto ? (
              <Pressable
                key={`${m.uri}-${i}`}
                onPress={() => handleAnnotatePhoto(m, i)}
                style={previewStyle}
              >
                {inner}
              </Pressable>
            ) : (
              <View key={`${m.uri}-${i}`} style={previewStyle}>
                {inner}
              </View>
            );
          })}
        </ScrollView>

        <ThemedText style={styles.label}>Titre</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholder="Optionnel — défaut: Sans titre"
          placeholderTextColor={theme.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.labelRow}>
          <ThemedText style={styles.labelInline}>Description</ThemedText>
          <DictationButton
            onTranscribed={(t) =>
              setDescription((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))
            }
          />
        </View>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Contexte, détails…"
          placeholderTextColor={theme.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <ThemedText style={styles.label}>Localisation</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholder="Ex: RDC, salle de bain"
          placeholderTextColor={theme.textTertiary}
          value={location}
          onChangeText={setLocation}
        />

        <ThemedText style={styles.label}>Sévérité</ThemedText>
        <View style={styles.severityRow}>
          {SEVERITY_OPTIONS.map((opt) => {
            const active = severity === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSeverity(active ? undefined : opt.value)}
                style={[
                  styles.severityChip,
                  {
                    borderColor: active ? BrandColors.accent : theme.border,
                    backgroundColor: active ? "#E6FFFA" : "transparent",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.severityChipText,
                    { color: active ? BrandColors.accent : theme.text },
                  ]}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.label}>Entreprise / Lot</ThemedText>
        <Pressable
          onPress={() => setShowContractorPicker(true)}
          style={[styles.input, styles.pickerInput, { borderColor: theme.border }]}
        >
          <ThemedText style={{ color: contractorName ? theme.text : theme.textTertiary }}>
            {contractorName || "Choisir dans la liste"}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, marginTop: Spacing.sm }]}
          placeholder="Ou saisir un nom libre"
          placeholderTextColor={theme.textTertiary}
          value={contractorName}
          onChangeText={(t) => {
            setContractorName(t);
            if (contractorId) setContractorId(undefined);
          }}
        />

        <Pressable
          onPress={handleSave}
          disabled={submitting}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: BrandColors.primary, opacity: pressed || submitting ? 0.7 : 1 },
          ]}
        >
          <Feather name="save" size={18} color="#FFFFFF" />
          <ThemedText style={styles.saveButtonText}>
            {submitting ? "Enregistrement…" : `Enregistrer ${modeLabel}`}
          </ThemedText>
        </Pressable>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showContractorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContractorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Entreprises</ThemedText>
              <Pressable onPress={() => setShowContractorPicker(false)}>
                <Feather name="x" size={22} color={BrandColors.primary} />
              </Pressable>
            </View>
            {contractorsFromCache ? (
              <View style={styles.staleHintRow}>
                <Feather name="wifi-off" size={13} color={theme.textTertiary} />
                <ThemedText style={[styles.staleHintText, { color: theme.textTertiary }]}>
                  Liste hors ligne (dernière synchro connue)
                </ThemedText>
              </View>
            ) : null}
            <FlatList
              data={sortedContractors}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <ThemedText style={styles.emptyPicker}>
                  {contractorsLoading
                    ? "Chargement des entreprises…"
                    : contractorsError
                      ? "Impossible de charger la liste des entreprises. Vérifiez la connexion, ou saisissez un nom libre."
                      : "Aucune entreprise disponible"}
                </ThemedText>
              }
              ListFooterComponent={
                <Pressable
                  onPress={() => pickContractor(null)}
                  style={styles.contractorRow}
                >
                  <Feather name="edit-3" size={16} color={BrandColors.primary} />
                  <ThemedText style={styles.contractorFreeText}>
                    Saisir un nom libre
                  </ThemedText>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => pickContractor(item)} style={styles.contractorRow}>
                  <View style={styles.contractorTextWrap}>
                    <ThemedText style={styles.contractorName}>{item.name}</ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={BrandColors.primary} />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  modeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  modeBannerText: { flex: 1, fontWeight: "600", fontSize: 14 },
  modeExitBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  modeExitText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginTop: Spacing.sm, opacity: 0.7 },
  mediaPreviewRow: { gap: Spacing.sm, paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  mediaPreview: {
    width: 110,
    height: 110,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPreviewImage: { width: "100%", height: "100%" },
  audioPreviewBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  mediaOverlay: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  mediaOverlayText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  audioDuration: { position: "absolute", bottom: 6, fontSize: 11, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", marginTop: Spacing.md, marginBottom: Spacing.xs },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  labelInline: { fontSize: 13, fontWeight: "600" },
  annotateBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  annotateBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  pickerInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  severityRow: { flexDirection: "row", gap: Spacing.sm },
  severityChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  severityChipText: { fontSize: 14, fontWeight: "600" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  saveButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "70%",
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: BrandColors.primary },
  contractorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: Spacing.sm,
  },
  contractorTextWrap: { flex: 1 },
  contractorLot: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  contractorName: { fontSize: 15, color: "#1F2937", marginTop: 2 },
  contractorFreeText: { fontSize: 15, fontWeight: "600", color: BrandColors.primary },
  emptyPicker: { padding: Spacing.lg, textAlign: "center", color: "#6B7280" },
  staleHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  staleHintText: { fontSize: 12, fontStyle: "italic" },
});
