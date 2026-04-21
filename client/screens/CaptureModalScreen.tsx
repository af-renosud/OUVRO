import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert, useWindowDimensions, Modal, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { CrossPlatformImage } from "@/components/CrossPlatformImage";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";
import { useProjectLock } from "@/hooks/useProjectLock";
import { useCaptureModeLock } from "@/hooks/useCaptureModeLock";
import type { SnagType } from "@/lib/archidoc-types";

export default function CaptureModalScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { lockedProject, isLocked } = useProjectLock();
  const { mode: captureMode, lockMode, unlockMode } = useCaptureModeLock();
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  useEffect(() => {
    if (isLocked && projects.length > 0) {
      const locked = projects.find((p) => p.id === lockedProject!.id);
      if (locked) {
        setSelectedProject(locked);
        return;
      }
    }
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject, isLocked, lockedProject]);

  const handleSelectProject = (project: MappedProject) => {
    setSelectedProject(project);
    setShowProjectPicker(false);
  };

  const getProject = (): { id: string; name: string } | null => {
    if (isLocked && lockedProject) {
      return lockedProject;
    }
    const project = selectedProject || projects[0];
    if (!project) {
      Alert.alert("No Project", "Please wait for projects to load");
      return null;
    }
    return project;
  };

  const handleButtonPress = (type: "photo" | "video" | "audio" | "action" | "dqe") => {
    const project = getProject();
    if (!project) return;

    switch (type) {
      case "photo":
        navigation.navigate("PhotoCapture", { projectId: project.id, projectName: project.name });
        break;
      case "video":
        navigation.navigate("VideoCapture", { projectId: project.id, projectName: project.name });
        break;
      case "audio":
        navigation.navigate("AudioCapture", { projectId: project.id, projectName: project.name });
        break;
      case "action":
        navigation.navigate("TaskCapture", { projectId: project.id, projectName: project.name });
        break;
      case "dqe":
        navigation.navigate("DQECapture", { projectId: project.id, projectName: project.name });
        break;
    }
  };

  const buttonSize = Math.min((height - 200) / 5, 100);

  const handleModePill = async (next: SnagType) => {
    if (captureMode === next) {
      await unlockMode();
    } else {
      await lockMode(next);
    }
  };

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
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.modePillsRow}>
          {(["defaut", "reserve"] as const).map((m) => {
            const active = captureMode === m;
            const dim = captureMode !== null && !active;
            const accent = m === "defaut" ? "#B91C1C" : "#92400E";
            const accentBorder = m === "defaut" ? "#FCA5A5" : "#FCD34D";
            const accentBg = m === "defaut" ? "#FEE2E2" : "#FEF3C7";
            const label = m === "defaut" ? "Défaut" : "Réserve";
            return (
              <Pressable
                key={m}
                onPress={() => handleModePill(m)}
                accessibilityRole="button"
                accessibilityLabel={`Mode ${label}`}
                accessibilityState={{ selected: active }}
                hitSlop={8}
                style={[
                  styles.modePill,
                  active && { borderColor: accentBorder, backgroundColor: accentBg },
                  dim && styles.modePillDim,
                ]}
              >
                <Feather
                  name={m === "defaut" ? "alert-triangle" : "flag"}
                  size={16}
                  color={active ? accent : "#FFFFFF"}
                />
                <ThemedText
                  style={[styles.modePillText, { color: active ? accent : "#FFFFFF" }]}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {captureMode ? (
          <ThemedText style={styles.modeHint}>
            Les captures seront enregistrées comme{" "}
            {captureMode === "defaut" ? "Défauts" : "Réserves"}.
          </ThemedText>
        ) : null}

        {isLocked ? (
          <View style={styles.lockedProjectSelector}>
            <View style={styles.lockIconContainer}>
              <Feather name="lock" size={16} color={BrandColors.accent} />
            </View>
            <View style={styles.projectInfo}>
              <ThemedText style={styles.lockedLabel}>Locked Project</ThemedText>
              <ThemedText style={styles.projectName} numberOfLines={1}>
                {lockedProject!.name}
              </ThemedText>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.projectSelector}
            onPress={() => setShowProjectPicker(true)}
          >
            {projectsLoading ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <>
                <View style={styles.projectInfo}>
                  <ThemedText style={styles.projectLabel}>Project:</ThemedText>
                  <ThemedText style={styles.projectName} numberOfLines={1}>
                    {selectedProject?.name || "Tap to select a project"}
                  </ThemedText>
                </View>
                <Feather name="chevron-down" size={20} color={BrandColors.primary} />
              </>
            )}
          </Pressable>
        )}

        <View style={styles.captureArea}>
          <View style={styles.captureGrid}>
            <View style={styles.captureRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.captureCardWrapper,
                  pressed ? styles.pressed : null,
                ]}
                onPress={() => handleButtonPress("photo")}
              >
                <View style={[styles.iconCircle, { width: buttonSize, height: buttonSize }]}>
                  <Feather name="camera" size={buttonSize * 0.38} color={BrandColors.accent} />
                </View>
                <ThemedText style={styles.captureLabel}>Photo</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.captureCardWrapper,
                  pressed ? styles.pressed : null,
                ]}
                onPress={() => handleButtonPress("video")}
              >
                <View style={[styles.iconCircle, { width: buttonSize, height: buttonSize }]}>
                  <Feather name="video" size={buttonSize * 0.38} color={BrandColors.accent} />
                </View>
                <ThemedText style={styles.captureLabel}>Video</ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.dqeCardWrapper,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => handleButtonPress("dqe")}
            >
              <View style={[styles.dqeIconCircle, { width: buttonSize * 1.15, height: buttonSize * 1.15 }]}>
                <Feather name="film" size={buttonSize * 0.42} color="#D97706" />
              </View>
              <ThemedText style={styles.captureLabel}>DQE</ThemedText>
              <ThemedText style={styles.dqeSubLabel}>Capture Vidéo</ThemedText>
            </Pressable>

            <View style={styles.captureRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.captureCardWrapper,
                  pressed ? styles.pressed : null,
                ]}
                onPress={() => handleButtonPress("audio")}
              >
                <View style={[styles.iconCircle, { width: buttonSize, height: buttonSize }]}>
                  <Feather name="mic" size={buttonSize * 0.38} color={BrandColors.accent} />
                </View>
                <ThemedText style={styles.captureLabel}>Audio</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.captureCardWrapper,
                  pressed ? styles.pressed : null,
                ]}
                onPress={() => handleButtonPress("action")}
              >
                <View style={[styles.iconCircle, styles.actionIconCircle, { width: buttonSize, height: buttonSize }]}>
                  <Feather name="clipboard" size={buttonSize * 0.38} color={BrandColors.accent} />
                </View>
                <ThemedText style={styles.captureLabel}>Action</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <Modal
        visible={showProjectPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Project</ThemedText>
              <Pressable onPress={() => setShowProjectPicker(false)}>
                <Feather name="x" size={24} color={BrandColors.primary} />
              </Pressable>
            </View>
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.projectItem,
                    selectedProject?.id === item.id && styles.projectItemSelected,
                  ]}
                  onPress={() => handleSelectProject(item)}
                >
                  <View style={styles.projectItemContent}>
                    <ThemedText style={styles.projectItemName}>{item.name}</ThemedText>
                    {item.clientName ? (
                      <ThemedText style={styles.projectItemClient}>{item.clientName}</ThemedText>
                    ) : null}
                  </View>
                  {selectedProject?.id === item.id ? (
                    <Feather name="check" size={20} color={BrandColors.accent} />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>No projects available</ThemedText>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B2545",
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
  content: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  captureArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -Spacing.xl * 2,
  },
  captureGrid: {
    flexDirection: "column",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  captureCardWrapper: {
    alignItems: "center",
    width: 100,
    gap: Spacing.sm,
  },
  dqeCardWrapper: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  captureLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  iconCircle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6FFFA",
    borderWidth: 3,
    borderColor: "#0B2545",
  },
  actionIconCircle: {
    borderColor: "#DC2626",
  },
  dqeIconCircle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 3.5,
    borderColor: "#D97706",
  },
  dqeSubLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#D97706",
    textAlign: "center",
    marginTop: -4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  modePillsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    minWidth: 110,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modePillDim: {
    opacity: 0.4,
  },
  modePillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modeHint: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    marginBottom: Spacing.md,
  },
  projectSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: BrandColors.accent,
  },
  lockedProjectSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: BrandColors.accent,
    gap: Spacing.sm,
  },
  lockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E6FFFA",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: BrandColors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  projectInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  projectLabel: {
    fontSize: 12,
    color: BrandColors.primary,
    marginBottom: 2,
  },
  projectName: {
    fontSize: 16,
    fontWeight: "600",
    color: BrandColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: BrandColors.primary,
  },
  projectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  projectItemSelected: {
    backgroundColor: "#F0FDF4",
  },
  projectItemContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  projectItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  projectItemClient: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});
