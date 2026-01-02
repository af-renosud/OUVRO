import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, useWindowDimensions, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import WebView from "react-native-webview";
import { captureScreen } from "react-native-view-shot";
import { StatusBar } from "expo-status-bar";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { formatFileSize, type ProjectFile } from "@/lib/archidoc-api";
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [hideChrome, setHideChrome] = useState(false);

  const isImage = file.contentType.startsWith("image/");
  const isPdf = file.contentType === "application/pdf";

  const handleAnnotate = () => {
    navigation.navigate("Annotation", {
      file,
      signedUrl,
      projectId: file.projectId,
    });
  };

  const handleCapturePdfClip = async () => {
    try {
      setIsCapturing(true);
      setHideChrome(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const capturedUri = await captureScreen({
        format: "png",
        quality: 1,
      });
      
      setHideChrome(false);
      
      const pdfName = file.originalName.replace(/\.pdf$/i, "");
      const timestamp = Date.now();
      const clipFileName = `clip-${pdfName}-${timestamp}.png`;
      
      const clipFile: ProjectFile = {
        objectId: `clip-${timestamp}`,
        objectName: clipFileName,
        originalName: clipFileName,
        contentType: "image/png",
        size: 0,
        projectId: file.projectId,
        category: "annotations",
        createdAt: new Date().toISOString(),
      };

      navigation.navigate("Annotation", {
        file: clipFile,
        signedUrl: capturedUri,
        projectId: file.projectId,
      });
    } catch (err) {
      console.error("PDF capture error:", err);
      setHideChrome(false);
      Alert.alert("Capture Failed", "Unable to capture the current view. Please try again.");
    } finally {
      setIsCapturing(false);
    }
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
        <View style={styles.pdfContainer}>
          <WebView
            source={{ uri: signedUrl }}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError("Failed to load PDF");
            }}
            scalesPageToFit={true}
            bounces={false}
          />
          {!hideChrome ? (
            <Pressable
              style={[
                styles.captureButton,
                { bottom: insets.bottom + Spacing.xl },
                isCapturing && styles.captureButtonDisabled,
              ]}
              onPress={handleCapturePdfClip}
              disabled={isCapturing || isLoading}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="camera" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.captureButtonText}>Capture for Annotation</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
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
      <StatusBar hidden={hideChrome} />
      {!hideChrome ? (
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
      ) : null}

      <View style={[styles.content, hideChrome && styles.contentFullscreen]}>
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
  contentFullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  pdfContainer: {
    flex: 1,
    position: "relative",
  },
  captureButton: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonText: {
    ...Typography.bodyBold,
    color: "#FFFFFF",
  },
});
