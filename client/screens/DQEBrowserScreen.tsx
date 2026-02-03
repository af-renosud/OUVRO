import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
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
  fetchContractors,
  getUniqueLotCodes,
  getFileDownloadUrl,
  type DQEItem,
  type DQEAttachment,
  type Contractor,
  type ProjectFile,
} from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHeaderHeight } from "@react-navigation/elements";

type FilterType = "lot" | "contractor";

export default function DQEBrowserScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DQEBrowser">>();
  const { projectId, projectName } = route.params;

  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("lot");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: () => fetchProjectById(projectId),
    staleTime: 1000 * 60 * 5,
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["/api/contractors"],
    queryFn: fetchContractors,
    staleTime: 1000 * 60 * 10,
  });

  const contractorMap = useMemo(() => {
    const map = new Map<string, string>();
    contractors.forEach((c) => {
      map.set(c.id, c.name);
    });
    return map;
  }, [contractors]);

  const items = project?.items || [];
  const lotCodes = useMemo(() => getUniqueLotCodes(items), [items]);
  
  const lotContractors = project?.lotContractors || {};
  
  const getContractorForItem = (item: DQEItem): string | null => {
    if (item.assignedContractorId) return item.assignedContractorId;
    return lotContractors[item.lotCode] || null;
  };

  const uniqueContractors = useMemo(() => {
    const contractorSet = new Map<string, string>();
    items.forEach((item) => {
      const contractorId = getContractorForItem(item);
      if (contractorId) {
        contractorSet.set(contractorId, contractorId);
      }
    });
    return Array.from(contractorSet.keys()).sort();
  }, [items, lotContractors]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeFilter === "lot" && selectedLot) {
      result = result.filter((item) => item.lotCode === selectedLot);
    }
    if (activeFilter === "contractor" && selectedContractor) {
      result = result.filter((item) => getContractorForItem(item) === selectedContractor);
    }
    return result;
  }, [items, selectedLot, selectedContractor, lotContractors, activeFilter]);

  const hasAttachments = (item: DQEItem): boolean => {
    return !!(item.attachments && item.attachments.length > 0);
  };

  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);

  const getContentType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
    };
    return mimeTypes[ext] || "application/octet-stream";
  };

  const handleAttachmentPress = async (att: DQEAttachment) => {
    setLoadingAttachmentId(att.id);
    try {
      let urlToUse = att.fileUrl;
      
      try {
        const freshData = await getFileDownloadUrl(att.id);
        if (freshData?.file?.freshUrl) {
          urlToUse = freshData.file.freshUrl;
        }
      } catch (e) {
        if (__DEV__) console.log("[DQE] Could not get fresh URL, using stored URL");
      }

      if (!urlToUse) {
        if (__DEV__) console.log("[DQE] No URL available for attachment");
        return;
      }

      const contentType = getContentType(att.fileName);
      const projectFile: ProjectFile = {
        objectId: att.id,
        objectName: att.fileName,
        originalName: att.fileName,
        contentType,
        size: 0,
        projectId: projectId,
        category: "general",
        createdAt: new Date().toISOString(),
      };

      // All files open in FileViewer first - user can tap Annotate button if needed
      navigation.navigate("FileViewer", {
        file: projectFile,
        signedUrl: urlToUse,
        projectId,
      });
    } catch (error: any) {
      if (__DEV__) console.error("[DQE] Error opening attachment:", error);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const renderFilterTab = (type: FilterType, label: string, count: number) => {
    const isActive = activeFilter === type;
    return (
      <Pressable
        style={[
          styles.filterTab,
          isActive && { backgroundColor: BrandColors.primary },
        ]}
        onPress={() => setActiveFilter(type)}
      >
        <ThemedText
          style={[
            styles.filterTabText,
            isActive ? { color: "#FFFFFF" } : { color: theme.textSecondary },
          ]}
        >
          {label} ({count})
        </ThemedText>
      </Pressable>
    );
  };

  const renderLotTab = (lot: string) => {
    const isActive = selectedLot === lot;
    return (
      <Pressable
        key={lot}
        style={[
          styles.optionTab,
          isActive && { backgroundColor: BrandColors.primary },
        ]}
        onPress={() => setSelectedLot(isActive ? null : lot)}
      >
        <ThemedText
          style={[
            styles.optionTabText,
            isActive ? { color: "#FFFFFF" } : { color: theme.textSecondary },
          ]}
        >
          {lot}
        </ThemedText>
      </Pressable>
    );
  };

  const getContractorDisplayName = (contractorId: string | null): string => {
    if (!contractorId) return "Non assigné";
    const name = contractorMap.get(contractorId);
    if (name) return name;
    return "Non assigné";
  };

  const renderContractorTab = (contractorId: string) => {
    const isActive = selectedContractor === contractorId;
    return (
      <Pressable
        key={contractorId}
        style={[
          styles.optionTab,
          isActive && { backgroundColor: BrandColors.primary },
        ]}
        onPress={() => setSelectedContractor(isActive ? null : contractorId)}
      >
        <ThemedText
          style={[
            styles.optionTabText,
            isActive ? { color: "#FFFFFF" } : { color: theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {getContractorDisplayName(contractorId)}
        </ThemedText>
      </Pressable>
    );
  };

  const truncateText = (text: string, maxLength: number = 50): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const renderItem = ({ item, index }: { item: DQEItem; index: number }) => {
    const isExpanded = expandedItemId === item.id;
    const hasFiles = hasAttachments(item);
    const contractorId = getContractorForItem(item);
    const itemNumber = index + 1;
    const showLotBadge = activeFilter !== "lot" || !selectedLot;

    return (
      <Pressable
        style={[styles.itemCard, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => setExpandedItemId(isExpanded ? null : item.id)}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.itemNumberBadge, { backgroundColor: theme.backgroundTertiary }]}>
            <ThemedText style={[styles.itemNumberText, { color: theme.textSecondary }]}>
              {itemNumber}
            </ThemedText>
          </View>
          <View style={styles.itemTitleContainer}>
            <ThemedText style={[styles.itemTitle, { color: theme.text }]} numberOfLines={isExpanded ? undefined : 1}>
              {isExpanded ? item.description : truncateText(item.description, 45)}
            </ThemedText>
            {!isExpanded ? (
              <View style={styles.compactMeta}>
                {showLotBadge ? (
                  <View style={[styles.metaBadge, { backgroundColor: BrandColors.primary }]}>
                    <ThemedText style={styles.metaBadgeText}>{item.lotCode}</ThemedText>
                  </View>
                ) : null}
                <View style={[styles.metaBadge, { backgroundColor: theme.backgroundTertiary }]}>
                  <ThemedText style={[styles.metaBadgeTextDark, { color: theme.textSecondary }]}>
                    {item.quantity} {item.unit}
                  </ThemedText>
                </View>
                {hasFiles ? (
                  <Feather name="paperclip" size={14} color={BrandColors.accent} />
                ) : null}
              </View>
            ) : null}
          </View>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.textTertiary}
          />
        </View>
        
        {isExpanded ? (
          <View style={styles.itemDetails}>
            <View style={styles.expandedMetaRow}>
              {showLotBadge ? (
                <View style={[styles.metaBadgeLarge, { backgroundColor: BrandColors.primary }]}>
                  <ThemedText style={styles.metaBadgeText}>{item.lotCode}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.metaBadgeLarge, { backgroundColor: theme.backgroundTertiary }]}>
                <ThemedText style={[styles.metaBadgeTextDark, { color: theme.text }]}>
                  {item.quantity} {item.unit}
                </ThemedText>
              </View>
            </View>
            {item.zone ? (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Zone:
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {item.zone}
                </ThemedText>
              </View>
            ) : null}
            {item.stageCode ? (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Étape:
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {item.stageCode}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Entreprise:
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text, fontStyle: contractorId ? "normal" : "italic" }]}>
                {getContractorDisplayName(contractorId)}
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
            {hasFiles ? (
              <View style={styles.attachmentsContainer}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Fiches ({item.attachments?.length}):
                </ThemedText>
                {item.attachments?.map((att) => {
                  const isLoading = loadingAttachmentId === att.id;
                  return (
                    <Pressable
                      key={att.id}
                      style={styles.attachmentItem}
                      onPress={() => handleAttachmentPress(att)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size={14} color={BrandColors.primary} />
                      ) : (
                        <Feather name="file" size={14} color={BrandColors.primary} />
                      )}
                      <ThemedText 
                        style={[styles.attachmentName, { color: BrandColors.primary }]} 
                        numberOfLines={1}
                      >
                        {att.fileName}
                      </ThemedText>
                      <Feather name="external-link" size={12} color={BrandColors.primary} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
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
        {selectedLot || selectedContractor
          ? "Aucun article correspondant aux filtres"
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
        <View style={styles.filterRow}>
          {renderFilterTab("lot", "Lot", lotCodes.length)}
          {renderFilterTab("contractor", "Entreprise", uniqueContractors.length)}
        </View>

        {activeFilter === "lot" && lotCodes.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.optionScroll}
            contentContainerStyle={styles.optionContainer}
          >
            {lotCodes.map(renderLotTab)}
          </ScrollView>
        ) : null}

        {activeFilter === "contractor" && uniqueContractors.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.optionScroll}
            contentContainerStyle={styles.optionContainer}
          >
            {uniqueContractors.map(renderContractorTab)}
          </ScrollView>
        ) : null}

        {activeFilter === "contractor" && uniqueContractors.length === 0 ? (
          <View style={styles.noFilterData}>
            <ThemedText style={[styles.noFilterText, { color: theme.textSecondary }]}>
              Aucune entreprise assignée
            </ThemedText>
          </View>
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
  },
  filterTabText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  optionScroll: {
    maxHeight: 44,
  },
  optionContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  optionTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  optionTabText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  noFilterData: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  noFilterText: {
    ...Typography.caption,
    fontStyle: "italic",
  },
  listContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  itemNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  itemNumberText: {
    ...Typography.caption,
    fontWeight: "700",
  },
  itemTitleContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemTitle: {
    ...Typography.body,
    fontWeight: "500",
    lineHeight: 20,
  },
  compactMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
    marginTop: 2,
  },
  metaBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  metaBadgeLarge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  metaBadgeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  metaBadgeTextDark: {
    fontSize: 10,
    fontWeight: "600",
  },
  expandedMetaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemDetails: {
    marginTop: Spacing.md,
    marginLeft: 0,
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
  attachmentsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: `${BrandColors.accent}15`,
    borderRadius: BorderRadius.sm,
  },
  attachmentName: {
    ...Typography.caption,
    flex: 1,
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
