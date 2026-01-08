import React, { useState, useRef } from "react";
import { View, StyleSheet, Pressable, Platform, Image, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function PhotoCaptureScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "PhotoCapture">>();
  const { projectId, projectName } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);

  const isLandscape = width > height;
  const isPhone = width < 500;
  const buttonSize = isPhone ? 80 : 100;
  const smallButtonSize = isPhone ? 48 : 56;

  const handleCapture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        setCapturedPhoto(photo.uri);
      }
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedPhoto(result.assets[0].uri);
    }
  };

  const handleDone = () => {
    if (capturedPhoto) {
      navigation.navigate("ObservationDetails", {
        projectId,
        projectName,
        mediaItems: [{ type: "photo", uri: capturedPhoto }],
      });
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <ThemedView style={styles.permissionContainer}>
          <Feather name="camera-off" size={64} color={theme.textTertiary} />
          <ThemedText style={styles.permissionText}>
            Camera permission is required
          </ThemedText>
          <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
            Please enable camera access in your device settings
          </ThemedText>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={styles.permissionButtonText}>Go Back</ThemedText>
          </Pressable>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.permissionContainer}>
        <Feather name="camera" size={64} color={BrandColors.primary} />
        <ThemedText style={styles.permissionText}>Camera Access Required</ThemedText>
        <ThemedText style={[styles.permissionSubtext, { color: theme.textSecondary }]}>
          We need camera access to capture site photos
        </ThemedText>
        <Pressable
          style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>Enable Camera</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (capturedPhoto) {
    if (isLandscape) {
      return (
        <View style={styles.landscapeContainer}>
          <View style={[styles.landscapeTopBar, { paddingTop: insets.top + Spacing.sm, paddingLeft: insets.left + Spacing.md }]}>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
          
          <View style={styles.landscapeMain}>
            <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
          </View>

          <View style={[styles.landscapeSideControls, { paddingRight: insets.right + Spacing.md }]}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              onPress={handleRetake}
            >
              <Feather name="refresh-cw" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
              onPress={handleDone}
            >
              <Feather name="check" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        <View style={[styles.previewOverlay, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
        <View
          style={[
            styles.previewControls,
            {
              paddingBottom: Math.max(insets.bottom, 20) + Spacing.lg,
              backgroundColor: "#0B2545",
            },
          ]}
        >
          <Pressable
            style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={handleRetake}
          >
            <Feather name="refresh-cw" size={22} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Retake</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
            onPress={handleDone}
          >
            <Feather name="check" size={22} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Use Photo</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLandscape) {
    return (
      <View style={styles.landscapeContainer}>
        <View style={[styles.landscapeTopBar, { paddingTop: insets.top + Spacing.sm, paddingLeft: insets.left + Spacing.md }]}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
        
        <View style={styles.landscapeMain}>
          {Platform.OS === "web" ? (
            <View style={[styles.webPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="camera" size={64} color={theme.textTertiary} />
              <ThemedText style={[styles.webText, { color: theme.textSecondary }]}>
                Camera preview is available on Expo Go
              </ThemedText>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
            />
          )}
        </View>

        <View style={[styles.landscapeSideControls, { paddingRight: insets.right + Spacing.md }]}>
          <Pressable
            style={styles.flipButton}
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          >
            <Feather name="refresh-cw" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              { width: buttonSize, height: buttonSize },
              pressed && styles.captureButtonPressed,
            ]}
            onPress={handleCapture}
          >
            <View style={styles.captureInner} />
          </Pressable>
          <Pressable
            style={[styles.galleryButton, { width: smallButtonSize, height: smallButtonSize }]}
            onPress={handlePickImage}
          >
            <Feather name="image" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <View style={[styles.webPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="camera" size={64} color={theme.textTertiary} />
          <ThemedText style={[styles.webText, { color: theme.textSecondary }]}>
            Camera preview is available on Expo Go
          </ThemedText>
          <Pressable
            style={[styles.pickButton, { backgroundColor: BrandColors.primary }]}
            onPress={handlePickImage}
          >
            <Feather name="image" size={20} color="#FFFFFF" />
            <ThemedText style={styles.pickButtonText}>Choose from Gallery</ThemedText>
          </Pressable>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />
      )}
      
      <View style={[styles.topControls, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Feather name="x" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={styles.flipButton}
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
        >
          <Feather name="refresh-cw" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View
        style={[
          styles.bottomControls,
          {
            paddingBottom: Math.max(insets.bottom, 20) + Spacing.lg,
            backgroundColor: "#0B2545",
          },
        ]}
      >
        <Pressable
          style={[styles.galleryButton, { width: smallButtonSize, height: smallButtonSize }]}
          onPress={handlePickImage}
        >
          <Feather name="image" size={isPhone ? 24 : 28} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            { width: buttonSize, height: buttonSize },
            pressed && styles.captureButtonPressed,
          ]}
          onPress={handleCapture}
        >
          <View style={styles.captureInner} />
        </Pressable>
        <View style={{ width: smallButtonSize }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B2545",
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0B2545",
  },
  landscapeTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
  },
  landscapeMain: {
    flex: 1,
  },
  landscapeSideControls: {
    width: 100,
    backgroundColor: "#0B2545",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  camera: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  webText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  pickButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  pickButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  topControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  galleryButton: {
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureInner: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#000000",
  },
  previewImage: {
    flex: 1,
    resizeMode: "contain",
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  previewControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 120,
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  permissionSubtext: {
    fontSize: 16,
    textAlign: "center",
  },
  permissionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
