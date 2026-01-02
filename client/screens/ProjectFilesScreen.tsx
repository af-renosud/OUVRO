import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import {
  fetchProjectFiles,
  getFileDownloadUrl,
  FILE_CATEGORIES,
  formatFileSize,
  getFileIcon,
  getCategoryLabel,
  type FileCategory,
  type ProjectFile,
} from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHeaderHeight } from "@react-navigation/elements";

export default function ProjectFilesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ProjectFiles">>();
  const { projectId, projectName } = route.params;

  const [selectedCategory, setSelectedCategory] = useState<FileCategory | null>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/archive/files", projectId, selectedCategory],
    queryFn: () => fetchProjectFiles(projectId, selectedCategory || undefined),
    staleTime: 1000 * 60 * 5,
  });

  const handleFilePress = async (file: ProjectFile) => {
    try {
      setLoadingFileId(file.objectId);
      const downloadInfo = await getFileDownloadUrl(file.objectId);
      navigation.navigate("FileViewer", {
        file,
        signedUrl: downloadInfo.file.freshUrl,
      });
    } catch (err) {
      console.error("Failed to get file URL:", err);
    } finally {
      setLoadingFileId(null);
    }
  };

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

  const renderFileItem = ({ item }: { item: ProjectFile }) => {
    const isLoadingThis = loadingFileId === item.objectId;
    const iconName = getFileIcon(item.contentType);
    const dateStr = new Date(item.createdAt).toLocaleDateString();

    return (
      <Pressable
        style={[styles.fileItem, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => handleFilePress(item)}
        disabled={isLoadingThis}
      >
        <View style={[styles.fileIcon, { backgroundColor: theme.backgroundTertiary }]}>
          {isLoadingThis ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Feather name={iconName as any} size={24} color={BrandColors.primary} />
          )}
        </View>
        <View style={styles.fileInfo}>
          <ThemedText style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
            {item.originalName}
          </ThemedText>
          <ThemedText style={[styles.fileMeta, { color: theme.textSecondary }]}>
            {formatFileSize(item.size)} • {dateStr}
          </ThemedText>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: theme.backgroundTertiary }]}>
          <ThemedText style={[styles.categoryBadgeText, { color: theme.textSecondary }]}>
            {getCategoryLabel(item.category)}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="folder" size={64} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        No Files Found
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {selectedCategory
          ? `No files in the "${selectedCategory}" category`
          : "This project has no files yet"}
      </ThemedText>
    </View>
  );

  if (error) {
    return (
      <BackgroundView style={styles.container}>
        <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={64} color={theme.textTertiary} />
            <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
              {(error as Error).message || "Failed to load files"}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
              onPress={() => refetch()}
            >
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        </View>
      </BackgroundView>
    );
  }

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

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading files...
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={files}
            keyExtractor={(item) => item.objectId}
            renderItem={renderFileItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + Spacing.xl },
            ]}
            ListEmptyComponent={renderEmptyState}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.bodyBold,
    marginBottom: 2,
  },
  fileMeta: {
    ...Typography.caption,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    textTransform: "uppercase",
  },
  separator: {
    height: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl * 3,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: "center",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    ...Typography.bodyBold,
    color: "#FFFFFF",
  },
});
