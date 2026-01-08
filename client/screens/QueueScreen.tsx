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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList, MediaItem } from "@/navigation/RootStackNavigator";
import type { OfflineObservation, ObservationSyncState } from "@/lib/offline-sync";

function SyncProgressBar({ progress, isActive }: { progress: number; isActive: boolean }) {
  const { theme } = useTheme();
  
  if (!isActive) return null;
  
  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSecondary }]}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${Math.max(progress, 0)}%`, backgroundColor: BrandColors.primary }
          ]} 
        />
      </View>
      <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
        {progress}% complete
      </ThemedText>
    </View>
  );
}

function MediaProgress({ observation }: { observation: OfflineObservation }) {
  const { theme } = useTheme();
  
  const completedMedia = observation.media.filter((m) => m.syncState === "complete").length;
  const totalMedia = observation.media.length;
  const uploadingMedia = observation.media.find((m) => m.syncState === "uploading");
  
  if (totalMedia === 0) return null;
  
  return (
    <View style={styles.mediaProgressContainer}>
      <View style={styles.mediaProgressRow}>
        <ThemedText style={[styles.mediaProgressText, { color: theme.textTertiary }]}>
          Files: {completedMedia}/{totalMedia}
        </ThemedText>
        {uploadingMedia ? (
          <View style={styles.uploadingIndicator}>
            <ActivityIndicator size="small" color={BrandColors.primary} />
            <ThemedText style={[styles.uploadingText, { color: BrandColors.primary }]}>
              {uploadingMedia.uploadProgress}%
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={[styles.miniProgressBg, { backgroundColor: theme.backgroundSecondary }]}>
        <View 
          style={[
            styles.miniProgressFill, 
            { 
              width: `${totalMedia > 0 ? (completedMedia / totalMedia) * 100 : 0}%`, 
              backgroundColor: BrandColors.success 
            }
          ]} 
        />
      </View>
    </View>
  );
}

export default function QueueScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const {
    observations,
    pendingCount,
    syncProgress,
    isSyncing,
    isNetworkAvailable,
    startSync,
    cancelSync,
    retryObservation,
    removeObservation,
  } = useOfflineSync();

  const handleSync = async (observation: OfflineObservation) => {
    if (observation.syncState === "failed") {
      await retryObservation(observation.localId);
    } else {
      await startSync();
    }
  };

  const handleSyncAll = async () => {
    if (!isNetworkAvailable) {
      Alert.alert("No Connection", "Please connect to the internet to sync observations.");
      return;
    }
    await startSync();
  };

  const handleCancelSync = () => {
    Alert.alert("Cancel Sync", "Are you sure you want to cancel the current sync?", [
      { text: "Continue Syncing", style: "cancel" },
      { text: "Cancel Sync", style: "destructive", onPress: cancelSync },
    ]);
  };

  const handleDelete = (localId: string) => {
    Alert.alert("Delete Observation", "Are you sure you want to delete this observation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeObservation(localId) },
    ]);
  };

  const handleShare = (observation: OfflineObservation) => {
    const mediaItems: MediaItem[] = observation.media.map((m) => ({
      type: m.type,
      uri: m.localUri,
      duration: undefined,
    }));
    
    navigation.navigate("ShareModal", {
      observation: {
        id: parseInt(observation.localId.replace(/\D/g, "")) || 0,
        title: observation.title,
        description: observation.description,
        transcription: observation.transcription,
        translatedText: observation.translatedText,
        mediaItems,
      },
      projectName: observation.projectName,
      contractorName: observation.contractorName,
    });
  };

  const getSyncStateInfo = (state: ObservationSyncState): { color: string; icon: keyof typeof Feather.glyphMap; label: string } => {
    switch (state) {
      case "pending":
        return { color: BrandColors.warning, icon: "clock", label: "Pending" };
      case "uploading_metadata":
      case "uploading_media":
        return { color: BrandColors.info, icon: "upload-cloud", label: "Syncing..." };
      case "partial":
        return { color: BrandColors.warning, icon: "alert-triangle", label: "Partial" };
      case "complete":
        return { color: BrandColors.success, icon: "check-circle", label: "Synced" };
      case "failed":
        return { color: BrandColors.error, icon: "alert-circle", label: "Failed" };
      default:
        return { color: theme.textTertiary, icon: "clock", label: "Unknown" };
    }
  };

  const renderObservation = ({ item }: { item: OfflineObservation }) => {
    const stateInfo = getSyncStateInfo(item.syncState);
    const isCurrentlySyncing = item.syncState === "uploading_metadata" || item.syncState === "uploading_media";
    
    return (
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
            {item.media.length > 0 ? (
              <ThemedText style={[styles.mediaCount, { color: theme.textTertiary }]}>
                {item.media.length} attachment{item.media.length > 1 ? "s" : ""}
              </ThemedText>
            ) : null}
          </View>
          <View style={[styles.syncBadge, { backgroundColor: stateInfo.color }]}>
            {isCurrentlySyncing ? (
              <ActivityIndicator size={14} color="#FFFFFF" />
            ) : (
              <Feather name={stateInfo.icon} size={14} color="#FFFFFF" />
            )}
          </View>
        </View>

        {isCurrentlySyncing ? (
          <MediaProgress observation={item} />
        ) : null}
        
        {item.description ? (
          <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </ThemedText>
        ) : null}

        {item.lastSyncError ? (
          <View style={[styles.errorBanner, { backgroundColor: `${BrandColors.error}20` }]}>
            <Feather name="alert-circle" size={14} color={BrandColors.error} />
            <ThemedText style={[styles.errorText, { color: BrandColors.error }]} numberOfLines={1}>
              {item.lastSyncError}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actionButtons}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: "#10B981" }]}
            onPress={() => handleShare(item)}
          >
            <Feather name="share-2" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Share</ThemedText>
          </Pressable>
          
          {item.syncState === "failed" || item.syncState === "partial" ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
              onPress={() => handleSync(item)}
              disabled={!isNetworkAvailable}
            >
              <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              <ThemedText style={styles.actionButtonText}>Retry</ThemedText>
            </Pressable>
          ) : item.syncState === "pending" ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
              onPress={() => handleSync(item)}
              disabled={!isNetworkAvailable || isSyncing}
            >
              <Feather name="upload-cloud" size={16} color="#FFFFFF" />
              <ThemedText style={styles.actionButtonText}>Sync</ThemedText>
            </Pressable>
          ) : isCurrentlySyncing ? (
            <View style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}>
              <ActivityIndicator size="small" color={BrandColors.primary} />
              <ThemedText style={[styles.actionButtonText, { color: BrandColors.primary }]}>
                Syncing...
              </ThemedText>
            </View>
          ) : null}
          
          <Pressable
            style={[styles.actionButtonIcon, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => handleDelete(item.localId)}
          >
            <Feather name="trash-2" size={18} color={BrandColors.error} />
          </Pressable>
        </View>
      </Card>
    );
  };

  const pendingObservations = observations.filter((obs) => obs.syncState !== "complete");

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <HeaderTitle />
        
        {!isNetworkAvailable ? (
          <View style={[styles.networkBanner, { backgroundColor: `${BrandColors.warning}20` }]}>
            <Feather name="wifi-off" size={16} color={BrandColors.warning} />
            <ThemedText style={[styles.networkText, { color: BrandColors.warning }]}>
              Offline - observations will sync when connected
            </ThemedText>
          </View>
        ) : null}
        
        <SyncProgressBar progress={syncProgress.overallProgress} isActive={isSyncing} />
        
        {pendingCount > 0 ? (
          <View style={styles.headerActions}>
            {isSyncing ? (
              <Pressable
                style={[styles.syncAllButton, { backgroundColor: BrandColors.error }]}
                onPress={handleCancelSync}
              >
                <Feather name="x" size={18} color="#FFFFFF" />
                <ThemedText style={styles.syncAllText}>Cancel</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.syncAllButton, 
                  { backgroundColor: isNetworkAvailable ? BrandColors.primary : theme.backgroundSecondary }
                ]}
                onPress={handleSyncAll}
                disabled={!isNetworkAvailable}
              >
                <Feather name="upload-cloud" size={18} color={isNetworkAvailable ? "#FFFFFF" : theme.textTertiary} />
                <ThemedText style={[styles.syncAllText, { color: isNetworkAvailable ? "#FFFFFF" : theme.textTertiary }]}>
                  Sync All ({pendingCount})
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      <FlatList
        data={pendingObservations}
        renderItem={renderObservation}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + 80, flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={false} 
            onRefresh={() => {}} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="check-circle" size={96} color={BrandColors.success} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              All synced!
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No pending observations
            </ThemedText>
          </View>
        }
      />
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
  headerActions: {
    marginTop: Spacing.md,
  },
  networkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    width: "100%",
  },
  networkText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  progressContainer: {
    width: "100%",
    marginTop: Spacing.md,
  },
  progressBarBg: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  progressText: {
    ...Typography.bodySmall,
    textAlign: "center",
    marginTop: Spacing.xs,
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
  mediaProgressContainer: {
    marginBottom: Spacing.sm,
  },
  mediaProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  mediaProgressText: {
    ...Typography.bodySmall,
  },
  uploadingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  uploadingText: {
    ...Typography.bodySmall,
    fontWeight: "600",
  },
  miniProgressBg: {
    height: 4,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  description: {
    ...Typography.bodySmall,
    marginBottom: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySmall,
    flex: 1,
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h2,
  },
  emptyText: {
    ...Typography.body,
  },
});
