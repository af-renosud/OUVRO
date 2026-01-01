import React, { useState } from "react";
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
import * as FileSystem from "expo-file-system";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
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
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());

  const { data: observations = [], isLoading, refetch, isRefetching } = useQuery<ObservationWithMedia[]>({
    queryKey: ["/api/observations/pending"],
  });

  const getMimeType = (type: string): string => {
    switch (type) {
      case "photo": return "image/jpeg";
      case "video": return "video/mp4";
      case "audio": return "audio/m4a";
      default: return "application/octet-stream";
    }
  };

  const uploadMediaToArchidoc = async (
    archidocObservationId: number,
    media: ObservationMedia
  ): Promise<boolean> => {
    if (!media.localUri) {
      console.log("[Upload] Skipping media with no localUri");
      return true;
    }

    if (media.localUri.startsWith("mock://") || media.localUri.startsWith("file://recording")) {
      console.log("[Upload] Skipping mock/placeholder media:", media.localUri);
      return true;
    }

    try {
      const assetType = media.type as "photo" | "video" | "audio";
      const fileName = media.localUri.split("/").pop() || `${assetType}_${Date.now()}`;
      const contentType = getMimeType(assetType);

      console.log(`[Upload] Starting upload for ${assetType}: ${fileName}`);
      console.log(`[Upload] Local URI: ${media.localUri}`);

      console.log(`[Upload] Reading file as base64...`);
      const fileBase64 = await FileSystem.readAsStringAsync(media.localUri, {
        encoding: "base64",
      });
      console.log(`[Upload] File read, size: ${Math.round(fileBase64.length / 1024)}KB base64`);

      console.log(`[Upload] Uploading via proxy...`);
      const uploadRes = await apiRequest("POST", "/api/archidoc/proxy-upload", {
        observationId: archidocObservationId,
        fileName,
        contentType,
        assetType,
        fileBase64,
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({ error: "Unknown error" }));
        console.error(`[Upload] Proxy upload failed: ${uploadRes.status} - ${errorData.error}`);
        return false;
      }

      const result = await uploadRes.json();
      console.log(`[Upload] Asset uploaded and registered: ${fileName}, path: ${result.objectPath}`);
      return true;
    } catch (error) {
      console.error("[Upload] Exception during upload:", error);
      return false;
    }
  };

  const syncMutation = useMutation({
    mutationFn: async (observation: ObservationWithMedia) => {
      setSyncingIds((prev) => new Set(prev).add(observation.id));
      
      const syncRes = await apiRequest("POST", `/api/sync-observation/${observation.id}`);
      const syncData = await syncRes.json();
      
      if (!syncRes.ok) {
        throw new Error(syncData.error || "Failed to create observation in ARCHIDOC");
      }
      
      const { archidocObservationId } = syncData;

      if (!archidocObservationId) {
        throw new Error("Failed to get ARCHIDOC observation ID");
      }

      const mediaItems = observation.media || [];
      let uploadFailures = 0;
      
      for (const media of mediaItems) {
        const success = await uploadMediaToArchidoc(archidocObservationId, media);
        if (!success) {
          uploadFailures++;
        }
      }

      if (uploadFailures > 0) {
        throw new Error(`Failed to upload ${uploadFailures} media file(s). Observation not marked as synced.`);
      }

      const markRes = await apiRequest("POST", `/api/mark-synced/${observation.id}`);
      if (!markRes.ok) {
        throw new Error("Failed to mark observation as synced");
      }
      
      return { localId: observation.id, archidocObservationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations/pending"] });
      Alert.alert("Success", "Observation synced to ARCHIDOC!");
    },
    onSettled: (_, __, observation) => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(observation.id);
        return next;
      });
    },
    onError: (error) => {
      console.error("Sync failed:", error);
      Alert.alert("Sync Failed", error instanceof Error ? error.message : "Failed to sync observation. Please try again.");
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

  const handleSync = (observation: ObservationWithMedia) => {
    syncMutation.mutate(observation);
  };

  const handleSyncAll = () => {
    observations.forEach((obs) => {
      if (obs.syncStatus === "pending") {
        syncMutation.mutate(obs);
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
          style={[styles.actionButton, { backgroundColor: "#10B981" }]}
          onPress={() => handleShare(item)}
        >
          <Feather name="share-2" size={16} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Share</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
          onPress={() => handleSync(item)}
          disabled={syncingIds.has(item.id)}
        >
          {syncingIds.has(item.id) ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="upload-cloud" size={16} color="#FFFFFF" />
          )}
          <ThemedText style={styles.actionButtonText}>
            {syncingIds.has(item.id) ? "Syncing..." : "Sync"}
          </ThemedText>
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
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  syncAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
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
