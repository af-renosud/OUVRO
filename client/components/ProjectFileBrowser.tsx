import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  Typography,
  BrandColors,
} from "@/constants/theme";
import {
  fetchProjectFiles,
  getFileDownloadUrl,
  getFileIcon,
  formatFileSize,
  getCategoryLabel,
  type ProjectFile,
  type FileCategory,
} from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export type ProjectFileBrowserProps = {
  projectId: string;
  category?: FileCategory | null;
  variant?: "simple" | "detailed";
  emptyIcon?: React.ComponentProps<typeof Feather>["name"];
  emptyTitle?: string;
  emptyText?: string;
  loadingText?: string;
  retryText?: string;
  style?: ViewStyle;
};

export function ProjectFileBrowser({
  projectId,
  category,
  variant = "simple",
  emptyIcon = "folder",
  emptyTitle = "Aucun fichier",
  emptyText = "Ce projet n'a pas encore de fichiers.",
  loadingText = "Chargement...",
  retryText = "Réessayer",
  style,
}: ProjectFileBrowserProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  const {
    data: files = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/archive/files", projectId, category ?? null],
    queryFn: () => fetchProjectFiles(projectId, category ?? undefined),
    staleTime: 1000 * 60 * 5,
  });

  const handleFilePress = async (file: ProjectFile) => {
    try {
      if (variant === "detailed") setLoadingFileId(file.objectId);
      const response = await getFileDownloadUrl(file.objectId);
      const fileForViewer = file.projectId ? file : { ...file, projectId };
      navigation.navigate("FileViewer", {
        file: fileForViewer,
        signedUrl: response.file.freshUrl,
      });
    } catch (err) {
      if (variant === "simple") {
        Alert.alert("Erreur", "Impossible d'ouvrir ce fichier.");
      } else {
        console.error("Failed to get file URL:", err);
      }
    } finally {
      if (variant === "detailed") setLoadingFileId(null);
    }
  };

  const renderSimpleItem = ({ item }: { item: ProjectFile }) => (
    <Pressable
      style={[styles.fileItem, { backgroundColor: theme.backgroundSecondary }]}
      onPress={() => handleFilePress(item)}
    >
      <View
        style={[
          styles.simpleFileIcon,
          { backgroundColor: theme.backgroundTertiary },
        ]}
      >
        <Feather
          name={getFileIcon(item.contentType)}
          size={20}
          color={BrandColors.primary}
        />
      </View>
      <View style={styles.fileInfo}>
        <ThemedText
          style={[styles.fileName, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.originalName}
        </ThemedText>
        <ThemedText
          style={[styles.fileSubtext, { color: theme.textSecondary }]}
        >
          {formatFileSize(item.size)}
        </ThemedText>
      </View>
      <Feather name="download" size={18} color={theme.textSecondary} />
    </Pressable>
  );

  const renderDetailedItem = ({ item }: { item: ProjectFile }) => {
    const isLoadingThis = loadingFileId === item.objectId;
    const dateStr = new Date(item.createdAt).toLocaleDateString();
    return (
      <Pressable
        style={[
          styles.fileItem,
          { backgroundColor: theme.backgroundSecondary },
        ]}
        onPress={() => handleFilePress(item)}
        disabled={isLoadingThis}
      >
        <View
          style={[
            styles.detailedFileIcon,
            { backgroundColor: theme.backgroundTertiary },
          ]}
        >
          {isLoadingThis ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Feather
              name={getFileIcon(item.contentType)}
              size={24}
              color={BrandColors.primary}
            />
          )}
        </View>
        <View style={styles.fileInfo}>
          <ThemedText
            style={[styles.fileNameBold, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.originalName}
          </ThemedText>
          <ThemedText
            style={[styles.fileSubtext, { color: theme.textSecondary }]}
          >
            {formatFileSize(item.size)} • {dateStr}
          </ThemedText>
        </View>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: theme.backgroundTertiary },
          ]}
        >
          <ThemedText
            style={[styles.categoryBadgeText, { color: theme.textSecondary }]}
          >
            {getCategoryLabel(item.category)}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name={emptyIcon} size={48} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        {emptyTitle}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {emptyText}
      </ThemedText>
    </View>
  );

  if (error) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Feather name="alert-circle" size={48} color={theme.textTertiary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          {(error as Error).message || "Erreur de chargement"}
        </ThemedText>
        <Pressable
          style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
          onPress={() => refetch()}
        >
          <ThemedText style={styles.retryText}>{retryText}</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <ThemedText
          style={[styles.loadingText, { color: theme.textSecondary }]}
        >
          {loadingText}
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      style={style}
      data={files}
      keyExtractor={(item) => item.objectId}
      renderItem={
        variant === "detailed" ? renderDetailedItem : renderSimpleItem
      }
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      ListEmptyComponent={renderEmptyState}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  simpleFileIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  detailedFileIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.body,
    marginBottom: 2,
  },
  fileNameBold: {
    ...Typography.bodyBold,
    marginBottom: 2,
  },
  fileSubtext: {
    ...Typography.caption,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    textTransform: "uppercase",
  },
  separator: {
    height: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
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
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
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
