import React, { useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Project } from "@shared/schema";

export default function ProjectsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [], isLoading, refetch, isRefetching } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/projects", { name, location: "New Location", status: "active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProject = ({ item }: { item: Project }) => (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed]}
      onPress={() => navigation.navigate("ProjectDetail", { projectId: item.id })}
    >
      <Card style={styles.projectCard}>
        <View style={styles.projectThumbnail}>
          <Feather name="briefcase" size={32} color={BrandColors.primary} />
        </View>
        <View style={styles.projectInfo}>
          <ThemedText style={styles.projectName}>{item.name}</ThemedText>
          {item.location ? (
            <ThemedText style={[styles.projectLocation, { color: theme.textSecondary }]}>
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
    </Pressable>
  );

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return BrandColors.success;
      case "pending":
        return BrandColors.warning;
      case "completed":
        return theme.textTertiary;
      default:
        return BrandColors.success;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <HeaderTitle title="ARCHIDOC Field" subtitle="Architects-France" />
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
    </ThemedView>
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
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
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
    marginBottom: Spacing.xs,
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
