import React, { useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { ProjectFile } from "@shared/schema";

type FileFilter = "all" | "plans" | "photos" | "documents";

export default function FilesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeFilter, setActiveFilter] = useState<FileFilter>("all");

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects/1/files"],
    enabled: false,
  });

  const filterTabs: { key: FileFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "plans", label: "Plans" },
    { key: "photos", label: "Photos" },
    { key: "documents", label: "Documents" },
  ];

  const getFileIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "plan":
        return "map";
      case "photo":
        return "image";
      case "document":
        return "file-text";
      default:
        return "file";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFile = ({ item }: { item: ProjectFile }) => (
    <Pressable style={({ pressed }) => [styles.fileCard, pressed && styles.pressed]}>
      <Card style={styles.fileCardInner}>
        <View style={[styles.fileThumbnail, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name={getFileIcon(item.type)} size={32} color={BrandColors.primary} />
        </View>
        <ThemedText style={styles.fileName} numberOfLines={2}>
          {item.name}
        </ThemedText>
        <View style={styles.fileInfo}>
          <ThemedText style={[styles.fileSize, { color: theme.textSecondary }]}>
            {formatFileSize(item.fileSize)}
          </ThemedText>
          {item.isDownloaded ? (
            <Feather name="check-circle" size={16} color={BrandColors.success} />
          ) : (
            <Feather name="download-cloud" size={16} color={theme.textTertiary} />
          )}
        </View>
      </Card>
    </Pressable>
  );

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable style={[styles.downloadButton, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="download" size={20} color={BrandColors.primary} />
        </Pressable>
        <Image
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterContainer}>
        {filterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && { backgroundColor: BrandColors.primary },
            ]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <ThemedText
              style={[
                styles.filterText,
                activeFilter === tab.key
                  ? { color: "#FFFFFF" }
                  : { color: theme.textSecondary },
              ]}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFile}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl + 80 },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="folder" size={64} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                No files downloaded
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Download files from your projects to annotate them on-site
              </ThemedText>
            </View>
          }
        />
      )}
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  headerSpacer: {
    width: 44,
  },
  downloadButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  filterText: {
    ...Typography.body,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  row: {
    justifyContent: "flex-start",
    gap: Spacing.md,
  },
  fileCard: {
    flex: 1,
    maxWidth: "48%",
    marginBottom: Spacing.md,
  },
  fileCardInner: {
    padding: Spacing.md,
    alignItems: "center",
  },
  fileThumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  fileName: {
    ...Typography.bodySmall,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  fileSize: {
    ...Typography.label,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
});
