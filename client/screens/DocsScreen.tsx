import React from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import {
  fetchProjectFiles,
  getFileDownloadUrl,
  getFileIcon,
  formatFileSize,
  type ProjectFile,
} from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type DocsScreenRouteProp = RouteProp<RootStackParamList, "DocsScreen">;

export default function DocsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<DocsScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { projectId, projectName } = route.params;

  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/archive/files", projectId, "general"],
    queryFn: () => fetchProjectFiles(projectId, "general"),
    staleTime: 1000 * 60 * 5,
  });

  const handleFilePress = async (file: ProjectFile) => {
    try {
      const response = await getFileDownloadUrl(file.objectId);
      if (file.contentType.includes("image")) {
        navigation.navigate("Annotation", {
          file,
          signedUrl: response.signedUrl,
          projectId,
        });
      } else {
        navigation.navigate("FileViewer", {
          file,
          signedUrl: response.signedUrl,
        });
      }
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'ouvrir ce fichier.");
    }
  };

  const renderFileItem = ({ item }: { item: ProjectFile }) => (
    <Pressable
      style={[styles.fileItem, { backgroundColor: theme.backgroundSecondary }]}
      onPress={() => handleFilePress(item)}
    >
      <View style={[styles.fileIcon, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name={getFileIcon(item.contentType) as any} size={20} color={BrandColors.primary} />
      </View>
      <View style={styles.fileInfo}>
        <ThemedText style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
          {item.originalName}
        </ThemedText>
        <ThemedText style={[styles.fileSize, { color: theme.textSecondary }]}>
          {formatFileSize(item.size)}
        </ThemedText>
      </View>
      <Feather name="download" size={18} color={theme.textSecondary} />
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="file-text" size={48} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        Aucun document
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Les documents généraux de ce projet n'ont pas encore été ajoutés.
      </ThemedText>
    </View>
  );

  if (error) {
    return (
      <BackgroundView style={styles.container}>
        <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
              {(error as Error).message || "Erreur de chargement"}
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
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.titleContainer}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Documents Généraux
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {projectName}
          </ThemedText>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Chargement des documents...
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={files}
            keyExtractor={(item) => item.objectId}
            renderItem={renderFileItem}
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
  titleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodySmall,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
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
  fileSize: {
    ...Typography.caption,
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
