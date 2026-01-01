import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Project, Observation, ProjectFile } from "@shared/schema";

export default function ProjectDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RootStackParamList, "ProjectDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { projectId } = route.params;

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: observations = [], isLoading: observationsLoading } = useQuery<Observation[]>({
    queryKey: ["/api/observations", { projectId }],
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects", projectId, "files"],
  });

  const isLoading = projectLoading || observationsLoading || filesLoading;

  const handleStartCapture = () => {
    navigation.navigate("CaptureModal");
  };

  const getSyncStatusColor = (status: string | null) => {
    switch (status) {
      case "pending":
        return BrandColors.warning;
      case "syncing":
        return BrandColors.info;
      case "synced":
        return BrandColors.success;
      default:
        return theme.textTertiary;
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={observations}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={
          <>
            <Card style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <View style={[styles.projectIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Feather name="briefcase" size={32} color={BrandColors.primary} />
                </View>
                <View style={styles.projectInfo}>
                  <ThemedText style={styles.projectName}>{project?.name}</ThemedText>
                  {project?.location ? (
                    <View style={styles.locationRow}>
                      <Feather name="map-pin" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.projectLocation, { color: theme.textSecondary }]}>
                        {project.location}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <ThemedText style={styles.statValue}>{observations.length}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Observations
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText style={styles.statValue}>{files.length}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Files
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText style={styles.statValue}>
                    {observations.filter((o) => o.syncStatus === "pending").length}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Pending
                  </ThemedText>
                </View>
              </View>

              <Pressable
                style={[styles.captureButton, { backgroundColor: BrandColors.primary }]}
                onPress={handleStartCapture}
              >
                <Feather name="camera" size={20} color="#FFFFFF" />
                <ThemedText style={styles.captureButtonText}>New Observation</ThemedText>
              </Pressable>
            </Card>

            <ThemedText style={styles.sectionTitle}>Recent Observations</ThemedText>
          </>
        }
        renderItem={({ item }) => (
          <Card style={styles.observationCard}>
            <View style={styles.observationHeader}>
              <View style={[styles.observationIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="file-text" size={20} color={BrandColors.primary} />
              </View>
              <View style={styles.observationInfo}>
                <ThemedText style={styles.observationTitle}>{item.title}</ThemedText>
                <ThemedText style={[styles.observationDate, { color: theme.textSecondary }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.syncBadge,
                  { backgroundColor: getSyncStatusColor(item.syncStatus) },
                ]}
              >
                <Feather
                  name={item.syncStatus === "synced" ? "check" : "clock"}
                  size={12}
                  color="#FFFFFF"
                />
              </View>
            </View>
            {item.description ? (
              <ThemedText
                style={[styles.observationDescription, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {item.description}
              </ThemedText>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No observations yet
            </ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: theme.textTertiary }]}>
              Tap "New Observation" to capture site documentation
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  projectCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  projectIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  projectLocation: {
    ...Typography.bodySmall,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    ...Typography.h2,
    color: BrandColors.primary,
  },
  statLabel: {
    ...Typography.label,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  captureButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  observationCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  observationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  observationIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  observationInfo: {
    flex: 1,
  },
  observationTitle: {
    ...Typography.h3,
    marginBottom: 2,
  },
  observationDate: {
    ...Typography.label,
  },
  syncBadge: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  observationDescription: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
});
