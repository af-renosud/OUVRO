import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
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
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);

  const isPhone = width < 500;

  const { data: projects = [] } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  const handleMediaTypeSelect = (type: MediaType) => {
    if (!selectedProject) {
      Alert.alert("Select Project", "Please select a project first");
      return;
    }

    switch (type) {
      case "photo":
        navigation.navigate("PhotoCapture", { projectId: selectedProject.id });
        break;
      case "video":
        navigation.navigate("VideoCapture", { projectId: selectedProject.id });
        break;
      case "audio":
        navigation.navigate("AudioCapture", { projectId: selectedProject.id });
        break;
    }
  };

  const renderMediaOption = (item: MediaOption) => (
    <Pressable
      key={item.type}
      style={({ pressed }) => [
        styles.mediaCardWrapper,
        isPhone ? styles.mediaCardWrapperPhone : styles.mediaCardWrapperTablet,
        pressed ? styles.pressed : null,
      ]}
      onPress={() => handleMediaTypeSelect(item.type)}
    >
      <Card style={isPhone ? { ...styles.mediaCard, ...styles.mediaCardPhone } : styles.mediaCard}>
        <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
          <Feather name={item.icon} size={isPhone ? 28 : 32} color={BrandColors.primary} />
        </View>
        <View style={isPhone ? styles.mediaTextPhone : undefined}>
          <ThemedText style={[styles.mediaTitle, isPhone && styles.mediaTitlePhone]}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.mediaDescription, { color: theme.textSecondary }]}>
            {item.description}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Select Project</ThemedText>
          <View style={styles.projectList}>
            {projects.slice(0, 5).map((project) => (
              <Pressable
                key={project.id}
                style={[
                  styles.projectChip,
                  {
                    backgroundColor:
                      selectedProject?.id === project.id
                        ? BrandColors.primary
                        : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => setSelectedProject(project)}
              >
                <ThemedText
                  style={[
                    styles.projectChipText,
                    {
                      color:
                        selectedProject?.id === project.id ? "#FFFFFF" : theme.text,
                    },
                  ]}
                >
                  {project.name}
                </ThemedText>
              </Pressable>
            ))}
            {projects.length === 0 ? (
              <ThemedText style={[styles.noProjects, { color: theme.textSecondary }]}>
                No projects available. Create one first.
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Capture Media</ThemedText>
          <View style={[styles.mediaGrid, isPhone && styles.mediaGridPhone]}>
            {mediaOptions.map(renderMediaOption)}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  projectList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  projectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  projectChipText: {
    ...Typography.bodySmall,
    fontWeight: "500",
  },
  noProjects: {
    ...Typography.body,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  mediaGridPhone: {
    flexDirection: "column",
  },
  mediaCardWrapper: {
    minWidth: 140,
  },
  mediaCardWrapperPhone: {
    width: "100%",
  },
  mediaCardWrapperTablet: {
    width: "48%",
  },
  mediaCard: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  mediaCardPhone: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  mediaTextPhone: {
    flex: 1,
    marginLeft: Spacing.md,
    marginBottom: 0,
  },
  mediaTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  mediaTitlePhone: {
    marginBottom: 2,
  },
  mediaDescription: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
