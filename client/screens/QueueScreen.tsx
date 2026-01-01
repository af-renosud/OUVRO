import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { Observation, ObservationMedia } from "@shared/schema";
import type { RootStackParamList, MediaItem } from "@/navigation/RootStackNavigator";

type ObservationWithMedia = Observation & {
  media?: ObservationMedia[];
  projectName?: string;
  contractorName?: string | null;
  contractorEmail?: string | null;
};

export default function QueueScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data: observations = [], isLoading, refetch, isRefetching } = useQuery<ObservationWithMedia[]>({
    queryKey: ["/api/observations/pending"],
  });

  const syncMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/sync-observation/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations/pending"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/observations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations/pending"] });
    },
  });

  const handleSync = (id: number) => {
    syncMutation.mutate(id);
  };

  const handleSyncAll = () => {
    observations.forEach((obs) => {
      if (obs.syncStatus === "pending") {
        syncMutation.mutate(obs.id);
      }
    });
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Observation", "Are you sure you want to delete this observation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleShare = (observation: ObservationWithMedia) => {
    const mediaItems: MediaItem[] = (observation.media || []).map((m) => ({
      type: m.type as "photo" | "video" | "audio",
      uri: m.localUri || m.remoteUrl || "",
      duration: m.duration || undefined,
    }));
    
    navigation.navigate("ShareModal", {
      observation: {
        id: observation.id,
        title: observation.title,
        description: observation.description || undefined,
        transcription: observation.transcription || undefined,
        translatedText: observation.translatedText || undefined,
        mediaItems,
      },
      projectName: observation.projectName || "Project",
      contractorName: observation.contractorName || undefined,
    });
  };

  const getSyncStatusColor = (status: string | null) => {
    switch (status) {
      case "pending":
        return BrandColors.warning;
      case "syncing":
        return BrandColors.info;
      case "synced":
        return BrandColors.success;
      case "failed":
        return BrandColors.error;
      default:
        return theme.textTertiary;
    }
  };

  const getSyncStatusIcon = (status: string | null): keyof typeof Feather.glyphMap => {
    switch (status) {
      case "pending":
        return "clock";
      case "syncing":
        return "refresh-cw";
      case "synced":
        return "check-circle";
      case "failed":
        return "alert-circle";
      default:
        return "clock";
    }
  };

  const renderObservation = ({ item }: { item: ObservationWithMedia }) => (
    <Card style={styles.observationCard}>
      <View style={styles.observationHeader}>
        <View style={styles.thumbnailPlaceholder}>
          <Feather name="file-text" size={24} color={BrandColors.primary} />
        </View>
        <View style={styles.observationInfo}>
          <ThemedText style={styles.observationTitle}>{item.title}</ThemedText>
          <ThemedText style={[styles.observationDate, { color: theme.textSecondary }]}>
            {item.projectName} - {new Date(item.createdAt).toLocaleDateString()}
          </ThemedText>
          {item.media && item.media.length > 0 ? (
            <ThemedText style={[styles.mediaCount, { color: theme.textTertiary }]}>
              {item.media.length} attachment{item.media.length > 1 ? "s" : ""}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.syncBadge, { backgroundColor: getSyncStatusColor(item.syncStatus) }]}>
          <Feather name={getSyncStatusIcon(item.syncStatus)} size={14} color="#FFFFFF" />
        </View>
      </View>
      
      {item.description ? (
        <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.description}
        </ThemedText>
      ) : null}

      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: BrandColors.mediumBlue }]}
          onPress={() => handleShare(item)}
        >
          <Feather name="share-2" size={16} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Share</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
          onPress={() => handleSync(item.id)}
          disabled={syncMutation.isPending}
        >
          <Feather name="upload-cloud" size={16} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Sync</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButtonIcon, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => handleDelete(item.id)}
        >
          <Feather name="trash-2" size={18} color={BrandColors.error} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Image
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        {observations.length > 0 ? (
          <Pressable
            style={[styles.syncAllButton, { backgroundColor: BrandColors.primary }]}
            onPress={handleSyncAll}
          >
            <Feather name="upload-cloud" size={18} color="#FFFFFF" />
            <ThemedText style={styles.syncAllText}>Sync All</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : (
        <FlatList
          data={observations}
          renderItem={renderObservation}
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
              <Feather name="check-circle" size={64} color={BrandColors.success} />
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                All synced!
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No pending observations
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
    width: 140,
    height: 44,
  },
  syncAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  syncAllText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  observationCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  observationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#EFF6FF",
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
    ...Typography.bodySmall,
  },
  mediaCount: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  syncBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    ...Typography.bodySmall,
    marginBottom: Spacing.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  actionButtonIcon: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
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
  emptyTitle: {
    ...Typography.h2,
  },
  emptyText: {
    ...Typography.body,
  },
});
