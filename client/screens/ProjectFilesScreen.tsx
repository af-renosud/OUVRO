import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { FILE_CATEGORIES, type FileCategory } from "@/lib/archidoc-api";
import { ProjectFileBrowser } from "@/components/ProjectFileBrowser";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function ProjectFilesScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RootStackParamList, "ProjectFiles">>();
  const { projectId, projectName } = route.params;

  const [selectedCategory, setSelectedCategory] = useState<FileCategory | null>(null);

  const renderCategoryTab = (category: typeof FILE_CATEGORIES[0]) => {
    const isActive = selectedCategory === category.key;
    return (
      <Pressable
        key={category.key}
        style={[
          styles.categoryTab,
          isActive && { backgroundColor: BrandColors.primary },
        ]}
        onPress={() => setSelectedCategory(isActive ? null : category.key)}
      >
        <Feather
          name={category.icon as any}
          size={16}
          color={isActive ? "#FFFFFF" : theme.textSecondary}
        />
        <ThemedText
          style={[
            styles.categoryTabText,
            isActive ? { color: "#FFFFFF" } : { color: theme.textSecondary },
          ]}
        >
          {category.code}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {FILE_CATEGORIES.map(renderCategoryTab)}
        </ScrollView>
        <ProjectFileBrowser
          projectId={projectId}
          category={selectedCategory}
          variant="detailed"
          emptyIcon="folder"
          emptyTitle="No Files Found"
          emptyText={
            selectedCategory
              ? `No files in the "${selectedCategory}" category`
              : "This project has no files yet"
          }
          loadingText="Loading files..."
          retryText="Try Again"
          style={styles.browser}
        />
      </View>
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  categoryTabText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  browser: {
    flex: 1,
  },
});
