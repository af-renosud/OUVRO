import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { useSiteReminders } from "@/hooks/useSiteReminders";
import type { SiteReminder, SiteReminderAttachment } from "@/lib/archidoc-types";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

function formatCachedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RemindersRoute = RouteProp<RootStackParamList, "SiteReminders">;

export default function SiteRemindersScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RemindersRoute>();
  const { projectId } = route.params;

  const {
    getReminders,
    getCachedAt,
    hasPendingToggle,
    hasFailedToggle,
    refreshFromServer,
    toggleDone,
    retryToggle,
    pendingCount,
  } = useSiteReminders();

  const [reminders, setReminders] = useState<SiteReminder[]>(() =>
    getReminders(projectId),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncFromCache = useCallback(() => {
    setReminders(getReminders(projectId));
  }, [getReminders, projectId]);

  const doRefresh = useCallback(
    async (isManual: boolean) => {
      if (isManual) setIsRefreshing(true);
      try {
        const fresh = await refreshFromServer(projectId);
        setReminders(fresh);
        setLoadError(null);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Échec du chargement des points à vérifier";
        setLoadError(message);
        syncFromCache();
      } finally {
        setIsLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    [projectId, refreshFromServer, syncFromCache],
  );

  useEffect(() => {
    syncFromCache();
    doRefresh(false);
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the list in sync with optimistic toggles / background reconciliation.
  useEffect(() => {
    syncFromCache();
  }, [pendingCount, syncFromCache]);

  const handleToggle = useCallback(
    async (reminder: SiteReminder) => {
      const next = !reminder.isDone;
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, isDone: next } : r)),
      );
      await toggleDone(projectId, reminder.id, next);
      syncFromCache();
    },
    [projectId, toggleDone, syncFromCache],
  );

  const openAttachment = useCallback(async (attachment: SiteReminderAttachment) => {
    if (!attachment.url) return;
    try {
      await WebBrowser.openBrowserAsync(attachment.url);
    } catch {
      // best-effort; nothing to recover
    }
  }, []);

  const cachedAtLabel = formatCachedAt(getCachedAt(projectId));
  const doneCount = reminders.filter((r) => r.isDone).length;

  const renderItem = useCallback(
    ({ item }: { item: SiteReminder }) => {
      const isExpanded = expandedId === item.id;
      const pending = hasPendingToggle(projectId, item.id);
      const failed = hasFailedToggle(projectId, item.id);
      const isImage = (a: SiteReminderAttachment) =>
        a.contentType.startsWith("image/");

      return (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <View style={styles.cardRow}>
            <Pressable
              onPress={() => handleToggle(item)}
              hitSlop={8}
              style={[
                styles.checkbox,
                {
                  borderColor: item.isDone
                    ? BrandColors.success
                    : theme.border,
                  backgroundColor: item.isDone
                    ? BrandColors.success
                    : "transparent",
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isDone }}
            >
              {item.isDone ? (
                <Feather name="check" size={18} color="#FFFFFF" />
              ) : null}
            </Pressable>

            <Pressable
              style={styles.cardContent}
              onPress={() =>
                setExpandedId((prev) => (prev === item.id ? null : item.id))
              }
            >
              <ThemedText
                style={[
                  styles.bodyText,
                  {
                    color: item.isDone ? theme.textTertiary : theme.text,
                    textDecorationLine: item.isDone ? "line-through" : "none",
                  },
                ]}
                numberOfLines={isExpanded ? undefined : 3}
              >
                {item.bodyText || "(Sans description)"}
              </ThemedText>

              <View style={styles.metaRow}>
                {item.attachments.length > 0 ? (
                  <View style={styles.metaChip}>
                    <Feather
                      name="paperclip"
                      size={12}
                      color={theme.textTertiary}
                    />
                    <ThemedText
                      style={[styles.metaText, { color: theme.textTertiary }]}
                    >
                      {item.attachments.length}
                    </ThemedText>
                  </View>
                ) : null}
                {pending ? (
                  <View style={styles.metaChip}>
                    <Feather name="upload-cloud" size={12} color={BrandColors.warning} />
                    <ThemedText
                      style={[styles.metaText, { color: BrandColors.warning }]}
                    >
                      En attente
                    </ThemedText>
                  </View>
                ) : null}
                {failed ? (
                  <Pressable
                    style={styles.metaChip}
                    onPress={() => retryToggle(projectId, item.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Réessayer la synchronisation"
                  >
                    <Feather name="refresh-cw" size={12} color={BrandColors.error} />
                    <ThemedText
                      style={[styles.metaText, { color: BrandColors.error }]}
                    >
                      Échec — réessayer
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textTertiary}
                  style={styles.chevron}
                />
              </View>
            </Pressable>
          </View>

          {isExpanded ? (
            <View style={styles.expanded}>
              {item.attachments.length > 0 ? (
                <View style={styles.attachments}>
                  {item.attachments.map((a) => (
                    <Pressable
                      key={a.objectPath}
                      style={[
                        styles.attachment,
                        { backgroundColor: theme.backgroundTertiary },
                      ]}
                      onPress={() => openAttachment(a)}
                      disabled={!a.url}
                    >
                      {isImage(a) && a.url ? (
                        <Image
                          source={{ uri: a.url }}
                          style={styles.thumbnail}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.thumbnail,
                            styles.fileThumb,
                            { backgroundColor: theme.border },
                          ]}
                        >
                          <Feather
                            name="file"
                            size={20}
                            color={theme.textSecondary}
                          />
                        </View>
                      )}
                      <ThemedText
                        style={[styles.attachmentName, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        {a.fileName}
                      </ThemedText>
                      {!a.url ? (
                        <ThemedText
                          style={[styles.attachmentHint, { color: theme.textTertiary }]}
                        >
                          Reconnectez-vous pour ouvrir
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [
      expandedId,
      hasPendingToggle,
      hasFailedToggle,
      retryToggle,
      projectId,
      theme,
      handleToggle,
      openAttachment,
    ],
  );

  return (
    <BackgroundView style={styles.container}>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => doRefresh(true)}
            tintColor={theme.textSecondary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {isOffline ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: theme.backgroundTertiary },
                ]}
              >
                <Feather name="wifi-off" size={14} color={theme.textSecondary} />
                <ThemedText
                  style={[styles.bannerText, { color: theme.textSecondary }]}
                >
                  Hors ligne — affichage des données enregistrées.
                  {cachedAtLabel ? ` Dernière mise à jour ${cachedAtLabel}.` : ""}
                </ThemedText>
              </View>
            ) : null}

            {loadError && !isOffline ? (
              <View
                style={[styles.banner, { backgroundColor: theme.backgroundTertiary }]}
              >
                <Feather name="alert-triangle" size={14} color={BrandColors.warning} />
                <ThemedText
                  style={[styles.bannerText, { color: theme.textSecondary }]}
                >
                  {loadError}
                </ThemedText>
              </View>
            ) : null}

            {reminders.length > 0 ? (
              <ThemedText style={[styles.progress, { color: theme.textTertiary }]}>
                {doneCount} / {reminders.length} vérifiés
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Feather name="check-circle" size={40} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Aucun point à vérifier pour ce projet.
              </ThemedText>
            </View>
          )
        }
      />
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listHeader: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  bannerText: {
    ...Typography.small,
    flex: 1,
  },
  progress: {
    ...Typography.small,
    fontWeight: "600",
    paddingHorizontal: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  bodyText: {
    ...Typography.body,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.small,
  },
  chevron: {
    marginLeft: "auto",
  },
  expanded: {
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  attachments: {
    gap: Spacing.sm,
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  fileThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    ...Typography.bodySmall,
    flex: 1,
  },
  attachmentHint: {
    ...Typography.small,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
});
