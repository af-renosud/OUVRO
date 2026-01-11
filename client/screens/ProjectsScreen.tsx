import React, { useState, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";

type StatusFilter = "active" | "archived" | "all";

const isArchivedStatus = (status: string | null): boolean => {
  const s = status?.toUpperCase() || "";
  return s.includes("ARCHIVED") || s.includes("ARCHIVE");
};

export default function ProjectsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const { data: projects = [], isLoading, refetch, isRefetching } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      const isArchived = isArchivedStatus(project.status);
      
      if (statusFilter === "active") return !isArchived;
      if (statusFilter === "archived") return isArchived;
      return true;
    });
  }, [projects, searchQuery, statusFilter]);

  const renderProject = ({ item }: { item: MappedProject }) => (
    <Card 
      style={styles.projectCard}
      onPress={() => navigation.navigate("ProjectAssetHub", { projectId: item.id })}
    >
      <View style={styles.projectThumbnail}>
        <Feather name="briefcase" size={32} color={BrandColors.primary} />
      </View>
      <View style={styles.projectInfo}>
        <ThemedText style={styles.projectName}>{item.name}</ThemedText>
        {item.clientName ? (
          <View style={styles.clientChip}>
            <ThemedText style={[styles.clientName, { color: BrandColors.info }]}>
              {item.clientName}
            </ThemedText>
          </View>
        ) : null}
        {item.location ? (
          <ThemedText style={[styles.projectLocation, { color: theme.textTertiary }]} numberOfLines={1}>
            {item.location}
          </ThemedText>
        ) : null}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <ThemedText style={styles.statusText}>
            {item.status || "Active"}
          </ThemedText>
        </View>
      </View>
      <Feather name="chevron-right" size={24} color={theme.textTertiary} />
    </Card>
  );

  const getStatusColor = (status: string | null) => {
    const s = status?.toUpperCase() || "";
    if (s.includes("PREPARATION") || s.includes("PENDING")) {
      return BrandColors.warning;
    }
    if (s.includes("COMPLETE") || s.includes("FINISHED")) {
      return theme.textTertiary;
    }
    if (s.includes("ACTIVE") || s.includes("PROGRESS")) {
      return BrandColors.success;
    }
    return BrandColors.info;
  };

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <HeaderTitle />
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="search" size={20} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search projects..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textTertiary} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterPill,
              { backgroundColor: theme.backgroundSecondary },
              statusFilter === "active" && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter("active")}
          >
            <ThemedText
              style={[
                styles.filterPillText,
                { color: statusFilter === "active" ? "#FFFFFF" : theme.text },
              ]}
            >
              Active
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.filterPill,
              { backgroundColor: theme.backgroundSecondary },
              statusFilter === "all" && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter("all")}
          >
            <ThemedText
              style={[
                styles.filterPillText,
                { color: statusFilter === "all" ? "#FFFFFF" : theme.text },
              ]}
            >
              All
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.filterPill,
              { backgroundColor: theme.backgroundSecondary },
              statusFilter === "archived" && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter("archived")}
          >
            <ThemedText
              style={[
                styles.filterPillText,
                { color: statusFilter === "archived" ? "#FFFFFF" : theme.text },
              ]}
            >
              Archived
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderProject}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="folder" size={64} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No projects found
              </ThemedText>
              <Pressable
                style={[styles.syncButton, { backgroundColor: BrandColors.primary }]}
                onPress={() => refetch()}
              >
                <ThemedText style={styles.syncButtonText}>Sync Projects</ThemedText>
              </Pressable>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl + Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterPillActive: {
    backgroundColor: BrandColors.primary,
  },
  filterPillText: {
    ...Typography.bodySmall,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  projectThumbnail: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...Typography.h3,
    marginBottom: 2,
    color: "#0B2545",
  },
  clientChip: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: BrandColors.info,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
  },
  clientName: {
    ...Typography.bodySmall,
  },
  projectLocation: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.label,
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
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
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
  },
  syncButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  syncButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
