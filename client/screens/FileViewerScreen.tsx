import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import WebView from "react-native-webview";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { formatFileSize } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function FileViewerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const { file, signedUrl } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isImage = file.contentType.startsWith("image/");
  const isPdf = file.contentType === "application/pdf";

  const handleAnnotate = () => {
    navigation.navigate("Annotation", {
      file,
      signedUrl,
      projectId: file.projectId,
    });
  };

  const renderContent = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color={theme.textTertiary} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            {error}
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
            onPress={() => setError(null)}
          >
            <ThemedText style={styles.retryText}>Try Again</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (isImage) {
      return (
        <View style={styles.imageContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color={BrandColors.primary} />
          ) : null}
          <Image
            source={{ uri: signedUrl }}
            style={styles.image}
            contentFit="contain"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError("Failed to load image");
            }}
          />
        </View>
      );
    }

    if (isPdf) {
      if (Platform.OS === "web") {
        return (
          <View style={styles.webPdfContainer}>
            <iframe
              src={signedUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title={file.originalName}
            />
          </View>
        );
      }
      return (
        <WebView
          source={{ uri: signedUrl }}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError("Failed to load PDF");
          }}
        />
      );
    }

    return (
      <View style={styles.unsupportedContainer}>
        <Feather name="file" size={64} color={theme.textTertiary} />
        <ThemedText style={[styles.unsupportedText, { color: theme.textSecondary }]}>
          This file type cannot be previewed
        </ThemedText>
        <ThemedText style={[styles.fileTypeText, { color: theme.textTertiary }]}>
          {file.contentType}
        </ThemedText>
      </View>
    );
  };

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={[styles.headerButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <ThemedText style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
            {file.originalName}
          </ThemedText>
          <ThemedText style={[styles.fileSize, { color: theme.textSecondary }]}>
            {formatFileSize(file.size)}
          </ThemedText>
        </View>
        {isImage ? (
          <Pressable
            style={[styles.annotateButton, { backgroundColor: BrandColors.primary }]}
            onPress={handleAnnotate}
          >
            <Feather name="edit-2" size={18} color="#FFFFFF" />
            <ThemedText style={styles.annotateText}>Annotate</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.content}>
        {isLoading && !error ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={BrandColors.primary} />
          </View>
        ) : null}
        {renderContent()}
      </View>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  headerInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.bodyBold,
  },
  fileSize: {
    ...Typography.caption,
  },
  annotateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  annotateText: {
    ...Typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  webview: {
    flex: 1,
  },
  webPdfContainer: {
    flex: 1,
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
  unsupportedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  unsupportedText: {
    ...Typography.body,
    textAlign: "center",
  },
  fileTypeText: {
    ...Typography.caption,
  },
});
