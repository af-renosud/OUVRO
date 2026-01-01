import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, Alert } from "react-native";
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);

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

  const renderMediaOption = ({ item }: { item: MediaOption }) => (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed]}
      onPress={() => handleMediaTypeSelect(item.type)}
    >
      <Card style={styles.mediaCard}>
        <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
          <Feather name={item.icon} size={32} color={BrandColors.primary} />
        </View>
        <ThemedText style={styles.mediaTitle}>{item.title}</ThemedText>
        <ThemedText style={[styles.mediaDescription, { color: theme.textSecondary }]}>
          {item.description}
        </ThemedText>
      </Card>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
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
          <FlatList
            data={mediaOptions}
            renderItem={renderMediaOption}
            keyExtractor={(item) => item.type}
            numColumns={2}
            columnWrapperStyle={styles.mediaRow}
            scrollEnabled={false}
          />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  mediaRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  mediaCard: {
    width: "48%",
    padding: Spacing.lg,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  mediaTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
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
