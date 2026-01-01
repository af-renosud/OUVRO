import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert, useWindowDimensions, Modal, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";

type MediaType = "photo" | "video" | "audio";

type MediaOption = {
  type: MediaType;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
};

const mediaOptions: MediaOption[] = [
  {
    type: "photo",
    icon: "camera",
    title: "Photo",
    description: "Take a photo and annotate it",
  },
  {
    type: "video",
    icon: "video",
    title: "Video",
    description: "Record a video of the site",
  },
  {
    type: "audio",
    icon: "mic",
    title: "Audio",
    description: "Record voice narration",
  },
];

export default function CaptureModalScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject]);

  const handleSelectProject = (project: MappedProject) => {
    setSelectedProject(project);
    setShowProjectPicker(false);
  };

  const handleMediaTypeSelect = (type: MediaType) => {
    const project = selectedProject || projects[0];
    if (!project) {
      Alert.alert("No Project", "Please wait for projects to load");
      return;
    }

    switch (type) {
      case "photo":
        navigation.navigate("PhotoCapture", { projectId: project.id });
        break;
      case "video":
        navigation.navigate("VideoCapture", { projectId: project.id });
        break;
      case "audio":
        navigation.navigate("AudioCapture", { projectId: project.id });
        break;
    }
  };

  const buttonSize = Math.min((height - 200) / 3.5, 140) * 0.8;

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <View style={[styles.headerBar, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Image
              source={require("../../assets/images/back-button.png")}
              style={styles.backButtonImage}
              contentFit="contain"
            />
          </Pressable>
          <Image
            source={require("../../assets/images/ouvro-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={styles.backButton} />
        </View>
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={styles.projectSelector}
          onPress={() => setShowProjectPicker(true)}
        >
          {projectsLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <View style={styles.projectInfo}>
                <ThemedText style={styles.projectLabel}>Project:</ThemedText>
                <ThemedText style={styles.projectName} numberOfLines={1}>
                  {selectedProject?.name || "Select a project"}
                </ThemedText>
              </View>
              <Feather name="chevron-down" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>

        <View style={styles.mediaGrid}>
          {mediaOptions.map((item) => (
            <Pressable
              key={item.type}
              style={({ pressed }) => [
                styles.mediaCardWrapper,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => handleMediaTypeSelect(item.type)}
            >
              <View style={[styles.iconCircle, { width: buttonSize, height: buttonSize }]}>
                <Feather name={item.icon} size={buttonSize * 0.45} color={BrandColors.accent} />
              </View>
            </Pressable>
          ))}
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
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
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
  mediaGrid: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  mediaCardWrapper: {
    alignItems: "center",
  },
  iconCircle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6FFFA",
    borderWidth: 3,
    borderColor: "#0B2545",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  projectSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  projectInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  projectLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 2,
  },
  projectName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
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
