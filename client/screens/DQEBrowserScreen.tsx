import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
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
  fetchProjectById,
  getUniqueLotCodes,
  filterItemsByLot,
  type DQEItem,
} from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHeaderHeight } from "@react-navigation/elements";

export default function DQEBrowserScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DQEBrowser">>();
  const { projectId, projectName } = route.params;

  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: () => fetchProjectById(projectId),
    staleTime: 1000 * 60 * 5,
  });

  const items = project?.items || [];
  const lotCodes = useMemo(() => getUniqueLotCodes(items), [items]);
  const filteredItems = useMemo(
    () => (selectedLot ? filterItemsByLot(items, selectedLot) : items),
    [items, selectedLot]
  );

  const renderLotTab = (lot: string) => {
    const isActive = selectedLot === lot;
    return (
      <Pressable
        key={lot}
        style={[
          styles.lotTab,
          isActive && { backgroundColor: BrandColors.primary },
        ]}
        onPress={() => setSelectedLot(isActive ? null : lot)}
      >
        <ThemedText
          style={[
            styles.lotTabText,
            isActive ? { color: "#FFFFFF" } : { color: theme.textSecondary },
          ]}
        >
          Lot {lot}
        </ThemedText>
      </Pressable>
    );
  };

  const renderItem = ({ item }: { item: DQEItem }) => {
    const isExpanded = expandedItemId === item.id;

    return (
      <Pressable
        style={[styles.itemCard, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => setExpandedItemId(isExpanded ? null : item.id)}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.lotBadge, { backgroundColor: BrandColors.primary }]}>
            <ThemedText style={styles.lotBadgeText}>
              {item.lotCode}
            </ThemedText>
          </View>
          <View style={styles.itemTitleContainer}>
            <ThemedText style={[styles.itemTitle, { color: theme.text }]} numberOfLines={isExpanded ? undefined : 2}>
              {item.designation}
            </ThemedText>
          </View>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textTertiary}
          />
        </View>
        
        {isExpanded ? (
          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Unité:
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {item.unit}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Quantité:
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {item.quantity}
              </ThemedText>
            </View>
            {item.notes ? (
              <View style={styles.notesContainer}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Notes:
                </ThemedText>
                <ThemedText style={[styles.notesText, { color: theme.text }]}>
                  {item.notes}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.itemSummary}>
            <ThemedText style={[styles.summaryText, { color: theme.textSecondary }]}>
              {item.quantity} {item.unit}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="list" size={64} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        Aucun Article DQE
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {selectedLot
          ? `Aucun article dans le Lot ${selectedLot}`
          : "Ce projet n'a pas encore d'articles DQE"}
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
              {(error as Error).message || "Échec du chargement"}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
              onPress={() => refetch()}
            >
              <ThemedText style={styles.retryText}>Réessayer</ThemedText>
            </Pressable>
          </View>
        </View>
      </BackgroundView>
    );
  }

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.sm }]}>
        {lotCodes.length > 0 ? (
          <FlatList
            horizontal
            data={lotCodes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => renderLotTab(item)}
            showsHorizontalScrollIndicator={false}
            style={styles.lotScroll}
            contentContainerStyle={styles.lotContainer}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Chargement DQE...
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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
  lotScroll: {
    maxHeight: 50,
  },
  lotContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  lotTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  lotTabText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  lotBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  lotBadgeText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemTitle: {
    ...Typography.body,
    fontWeight: "500",
  },
  itemSummary: {
    marginTop: Spacing.sm,
    marginLeft: 40,
  },
  summaryText: {
    ...Typography.caption,
  },
  itemDetails: {
    marginTop: Spacing.md,
    marginLeft: 40,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  detailLabel: {
    ...Typography.caption,
    width: 70,
  },
  detailValue: {
    ...Typography.body,
    flex: 1,
  },
  notesContainer: {
    marginTop: Spacing.sm,
  },
  notesText: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    fontStyle: "italic",
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
