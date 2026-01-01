import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type FileFilter = "all" | "plans" | "photos" | "documents";

export default function FilesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeFilter, setActiveFilter] = useState<FileFilter>("all");

  const filterTabs: { key: FileFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "plans", label: "Plans" },
    { key: "photos", label: "Photos" },
    { key: "documents", label: "Documents" },
  ];

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

      <View style={styles.emptyContainer}>
        <Feather name="folder" size={64} color={theme.textTertiary} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          Coming Soon
        </ThemedText>
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          File downloads and annotations will be available in a future update
        </ThemedText>
      </View>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  filterText: {
    ...Typography.bodySmall,
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
