import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, Alert, Linking, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { getAllDQEAttachments, getFileDownloadUrl, type DQEItem, type DQEAttachment, type ProjectFile } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type FichesScreenRouteProp = RouteProp<RootStackParamList, "FichesScreen">;

type FicheEntry = {
  item: DQEItem;
  attachment: DQEAttachment;
};

export default function FichesScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<FichesScreenRouteProp>();
  const { projectId, projectName, items } = route.params;
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);

  const fiches = getAllDQEAttachments(items);

  const getContentType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split(".").pop();
    if (["jpg", "jpeg"].includes(ext || "")) return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "pdf") return "application/pdf";
    if (["doc", "docx"].includes(ext || "")) return "application/msword";
    if (["xls", "xlsx"].includes(ext || "")) return "application/vnd.ms-excel";
    return "application/octet-stream";
  };

  const isImageFile = (fileName: string): boolean => {
    const ext = fileName.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  };

  const handleFichePress = async (entry: FicheEntry) => {
    try {
      setLoadingAttachmentId(entry.attachment.id);
      
      // Try to get fresh signed URL using attachment id as objectId
      let freshUrl: string | null = null;
      
      if (entry.attachment.id) {
        try {
          const response = await getFileDownloadUrl(entry.attachment.id);
          if (response?.file?.freshUrl) {
            freshUrl = response.file.freshUrl;
          }
        } catch (urlError) {
          console.log("Could not get fresh URL, using stored fileUrl:", urlError);
        }
      }
      
      const urlToUse = freshUrl || entry.attachment.fileUrl;
      const contentType = getContentType(entry.attachment.fileName);
      
      // Create a ProjectFile-like object for navigation
      const file: ProjectFile = {
        objectId: entry.attachment.id,
        objectName: entry.attachment.fileName,
        originalName: entry.attachment.fileName,
        contentType,
        size: 0,
        projectId: projectId,
        category: "general",
        createdAt: new Date().toISOString(),
      };
      
      // For images, go directly to annotation screen
      if (isImageFile(entry.attachment.fileName)) {
        navigation.navigate("Annotation", {
          file,
          signedUrl: urlToUse,
          projectId,
        });
      } else {
        // For other files, open in FileViewer
        navigation.navigate("FileViewer", {
          file,
          signedUrl: urlToUse,
        });
      }
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'ouvrir le fichier.");
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "pdf") return "file-text";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "image";
    if (["doc", "docx"].includes(ext || "")) return "file-text";
    if (["xls", "xlsx"].includes(ext || "")) return "grid";
    return "file";
  };

  const renderFicheItem = ({ item }: { item: FicheEntry }) => {
    const isLoading = loadingAttachmentId === item.attachment.id;
    const isImage = isImageFile(item.attachment.fileName);
    
    return (
      <Pressable
        style={[styles.ficheItem, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => handleFichePress(item)}
        disabled={isLoading}
      >
        <View style={[styles.ficheIcon, { backgroundColor: theme.backgroundTertiary }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Feather name={getFileIcon(item.attachment.fileName) as any} size={20} color={BrandColors.primary} />
          )}
        </View>
        <View style={styles.ficheInfo}>
          <ThemedText style={[styles.ficheName, { color: theme.text }]} numberOfLines={1}>
            {item.attachment.fileName}
          </ThemedText>
          <ThemedText style={[styles.ficheSource, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.item.lotCode} - {item.item.description}
          </ThemedText>
        </View>
        {isImage ? (
          <View style={[styles.annotationBadge, { backgroundColor: BrandColors.primary }]}>
            <Feather name="edit-2" size={12} color="#FFFFFF" />
          </View>
        ) : null}
        <View style={[styles.fileTypeBadge, { backgroundColor: `${BrandColors.primary}15` }]}>
          <ThemedText style={[styles.fileTypeText, { color: BrandColors.primary }]}>
            {getFileExtension(item.attachment.fileName)}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="paperclip" size={48} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        Aucune fiche technique
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Les fiches techniques des articles DQE n'ont pas encore été ajoutées.
      </ThemedText>
    </View>
  );

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.titleContainer}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Fiches Techniques
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {projectName} - {fiches.length} fiche{fiches.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        <FlatList
          data={fiches}
          keyExtractor={(item, index) => `${item.item.id}-${item.attachment.id}-${index}`}
          renderItem={renderFicheItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          ListEmptyComponent={renderEmptyState}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
  ficheItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  ficheIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  ficheInfo: {
    flex: 1,
  },
  ficheName: {
    ...Typography.body,
    marginBottom: 2,
  },
  ficheSource: {
    ...Typography.caption,
  },
  fileTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  annotationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  fileTypeText: {
    ...Typography.caption,
    fontWeight: "600",
    fontSize: 10,
  },
  separator: {
    height: Spacing.sm,
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
});
