import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, useWindowDimensions, Modal, TextInput, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { CrossPlatformImage } from "@/components/CrossPlatformImage";
import Svg, { Path, Circle, Rect, Line, G, Text as SvgText } from "react-native-svg";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { ANNOTATION_COLORS, requestUploadUrl, archiveUploadedFile, type AnnotationType } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type DrawingElement = {
  id: string;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  points: number[][];
  text?: string;
};

const TOOLS: { type: AnnotationType; icon: string; label: string }[] = [
  { type: "freehand", icon: "edit-3", label: "Pen" },
  { type: "arrow", icon: "arrow-up-right", label: "Arrow" },
  { type: "rectangle", icon: "square", label: "Rectangle" },
  { type: "circle", icon: "circle", label: "Circle" },
  { type: "text", icon: "type", label: "Text" },
  { type: "measurement", icon: "maximize-2", label: "Mesure" },
];

const STROKE_WIDTHS = [2, 4, 6, 8];

export default function AnnotationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Annotation">>();
  const { file, signedUrl, projectId } = route.params;

  const viewShotRef = useRef<ViewShot>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationType>("freehand");
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].hex);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [pendingTextPosition, setPendingTextPosition] = useState<number[] | null>(null);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  
  // Zoom state using shared values for smooth animations
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Use refs for real-time point collection to avoid React state update delays
  const currentPointsRef = useRef<number[][]>([]);
  const isDrawingRef = useRef(false);
  const drawingUpdateCounter = useSharedValue(0);

  const handleImageError = useCallback(() => {
    setImageError("Unable to load image. The URL may have expired.");
    Alert.alert(
      "Image Load Error",
      "Unable to load the image for annotation. Please go back and try again.",
      [{ text: "OK", onPress: () => navigation.goBack() }]
    );
  }, [navigation]);

  // Use measured dimensions if available, otherwise fallback to calculated values
  const fallbackWidth = screenWidth;
  const fallbackHeight = Math.max(screenHeight - insets.top - insets.bottom - 160, 200);
  const canvasWidth = canvasDimensions.width > 0 ? canvasDimensions.width : fallbackWidth;
  const canvasHeight = canvasDimensions.height > 0 ? canvasDimensions.height : fallbackHeight;
  
  const handleCanvasLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasDimensions({ width, height });
    }
  }, []);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const createNewElement = useCallback((x: number, y: number): DrawingElement => ({
    id: generateId(),
    type: selectedTool,
    color: selectedColor,
    strokeWidth,
    points: [[x, y]],
  }), [selectedTool, selectedColor, strokeWidth]);

  const handlePanStart = useCallback((x: number, y: number, tool: AnnotationType) => {
    if (tool === "text") return;
    isDrawingRef.current = true;
    currentPointsRef.current = [[x, y]];
    const newElement: DrawingElement = {
      id: generateId(),
      type: tool,
      color: selectedColor,
      strokeWidth,
      points: [[x, y]],
    };
    setCurrentElement(newElement);
  }, [selectedColor, strokeWidth]);

  const handlePanUpdate = useCallback((x: number, y: number, tool: AnnotationType) => {
    if (tool === "text" || !isDrawingRef.current) return;
    
    // Add point to ref immediately (no React state delay)
    if (tool === "freehand") {
      currentPointsRef.current.push([x, y]);
    } else {
      // For shapes, just update the end point
      currentPointsRef.current = [currentPointsRef.current[0], [x, y]];
    }
    
    // Update React state with current points
    setCurrentElement((prev) => {
      if (!prev) return prev;
      return { ...prev, points: [...currentPointsRef.current] };
    });
  }, []);

  const handlePanEnd = useCallback(() => {
    isDrawingRef.current = false;
    setCurrentElement((prev) => {
      if (prev && currentPointsRef.current.length > 0) {
        // Use the complete points from ref
        const finalElement = { ...prev, points: [...currentPointsRef.current] };
        setElements((els) => [...els, finalElement]);
      }
      currentPointsRef.current = [];
      return null;
    });
  }, []);

  const handleTapEnd = useCallback((x: number, y: number, tool: AnnotationType) => {
    if (tool === "text") {
      setPendingTextPosition([x, y]);
      setTextInput("");
      setShowTextModal(true);
    }
  }, []);

  // Drawing gestures (when not in zoom mode)
  const drawPanGesture = Gesture.Pan()
    .minDistance(1)
    .enabled(!isZoomMode)
    .onStart((e) => {
      runOnJS(handlePanStart)(e.x, e.y, selectedTool);
    })
    .onUpdate((e) => {
      runOnJS(handlePanUpdate)(e.x, e.y, selectedTool);
    })
    .onEnd(() => {
      runOnJS(handlePanEnd)();
    });

  const tapGesture = Gesture.Tap()
    .enabled(!isZoomMode)
    .onEnd((e) => {
      runOnJS(handleTapEnd)(e.x, e.y, selectedTool);
    });

  // Zoom gestures (when in zoom mode)
  const pinchGesture = Gesture.Pinch()
    .enabled(isZoomMode)
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(newScale, 0.5), 5);
    });

  const zoomPanGesture = Gesture.Pan()
    .enabled(isZoomMode)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(isZoomMode)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  // Animated style for zoom transforms
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Combine gestures based on mode
  const zoomGestures = Gesture.Simultaneous(pinchGesture, zoomPanGesture, doubleTapGesture);
  const drawGestures = Gesture.Race(drawPanGesture, tapGesture);
  const gesture = isZoomMode ? zoomGestures : drawGestures;
  
  const handleResetZoom = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }, [scale, translateX, translateY]);

  const handleAddText = () => {
    if (textInput.trim() && pendingTextPosition) {
      const newElement: DrawingElement = {
        id: generateId(),
        type: "text",
        color: selectedColor,
        strokeWidth,
        points: [pendingTextPosition],
        text: textInput.trim(),
      };
      setElements((prev) => [...prev, newElement]);
    }
    setShowTextModal(false);
    setTextInput("");
    setPendingTextPosition(null);
  };

  const handleUndo = () => {
    setElements((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    Alert.alert(
      "Clear All",
      "Are you sure you want to clear all annotations?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => setElements([]) },
      ]
    );
  };

  const handleSave = async () => {
    if (elements.length === 0) {
      Alert.alert("No Annotations", "Please add some annotations before saving.");
      return;
    }

    // Validate canvas dimensions before capture
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      Alert.alert("Error", "Canvas not ready. Please wait a moment and try again.");
      return;
    }

    try {
      setIsSaving(true);
      const startTime = Date.now();
      
      // Reset zoom before capture to ensure full image is saved
      const wasZoomed = scale.value !== 1 || translateX.value !== 0 || translateY.value !== 0;
      if (wasZoomed) {
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        // Minimal wait for transform - just one frame
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      if (viewShotRef.current) {
        if (__DEV__) console.log("[Annotation] Starting capture...");
        
        // Use JPEG format for faster encoding and smaller file size
        // Quality 0.85 provides good balance of quality vs speed
        const uri = await captureRef(viewShotRef, {
          format: "jpg",
          quality: 0.85,
          result: "tmpfile",
          width: Math.max(canvasWidth, 100),
          height: Math.max(canvasHeight, 100),
        });
        if (__DEV__) console.log("[Annotation] Captured in", Date.now() - startTime, "ms");
        
        const fileName = `annotated-${file.originalName.replace(/\.[^/.]+$/, "")}-${Date.now()}.jpg`;

        // Get file info while preparing upload URL request in parallel
        const [fileInfo, uploadInfo] = await Promise.all([
          FileSystem.getInfoAsync(uri),
          requestUploadUrl(fileName, "image/jpeg", 0), // Size unknown yet, but not critical for URL request
        ]);
        
        const fileSize = (fileInfo as any).size || 0;
        if (__DEV__) console.log("[Annotation] File size:", fileSize, "- Got upload URL in", Date.now() - startTime, "ms");

        // Upload using native binary upload for maximum speed
        const uploadResult = await FileSystem.uploadAsync(uploadInfo.uploadURL, uri, {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": "image/jpeg" },
        });
        if (__DEV__) console.log("[Annotation] Upload complete in", Date.now() - startTime, "ms");

        // Verify upload succeeded (200 or 201)
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
        }

        // Archive the file
        await archiveUploadedFile({
          objectId: uploadInfo.objectId,
          bucketName: uploadInfo.bucketName,
          objectName: uploadInfo.objectName,
          originalName: fileName,
          contentType: "image/jpeg",
          size: fileSize,
          projectId,
          category: "annotations",
        });
        if (__DEV__) console.log("[Annotation] Total time:", Date.now() - startTime, "ms");

        Alert.alert(
          "Saved",
          "Annotation saved to project files.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error("Save error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to save annotation. ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderElement = (element: DrawingElement) => {
    const { id, type, color, strokeWidth: sw, points, text } = element;

    if (type === "freehand" && points.length > 1) {
      const pathData = points.reduce((acc, [x, y], i) => {
        return acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
      }, "");
      return (
        <Path
          key={id}
          d={pathData}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    if (type === "arrow" && points.length === 2) {
      const [[x1, y1], [x2, y2]] = points;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLength = 15;
      const arrowAngle = Math.PI / 6;
      const ax1 = x2 - arrowLength * Math.cos(angle - arrowAngle);
      const ay1 = y2 - arrowLength * Math.sin(angle - arrowAngle);
      const ax2 = x2 - arrowLength * Math.cos(angle + arrowAngle);
      const ay2 = y2 - arrowLength * Math.sin(angle + arrowAngle);

      return (
        <G key={id}>
          <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} />
          <Line x1={x2} y1={y2} x2={ax1} y2={ay1} stroke={color} strokeWidth={sw} />
          <Line x1={x2} y1={y2} x2={ax2} y2={ay2} stroke={color} strokeWidth={sw} />
        </G>
      );
    }

    if (type === "rectangle" && points.length === 2) {
      const [[x1, y1], [x2, y2]] = points;
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      return (
        <Rect
          key={id}
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      );
    }

    if (type === "circle" && points.length === 2) {
      const [[x1, y1], [x2, y2]] = points;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      return (
        <Circle
          key={id}
          cx={cx}
          cy={cy}
          r={Math.max(rx, ry)}
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      );
    }

    if (type === "text" && text && points.length > 0) {
      const [[x, y]] = points;
      return (
        <SvgText
          key={id}
          x={x}
          y={y}
          fill={color}
          fontSize={sw * 4}
          fontWeight="bold"
        >
          {text}
        </SvgText>
      );
    }

    if (type === "measurement" && points.length === 2) {
      const [[x1, y1], [x2, y2]] = points;
      const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const tickLength = 8;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const perpAngle = angle + Math.PI / 2;
      
      const tick1x1 = x1 + tickLength * Math.cos(perpAngle);
      const tick1y1 = y1 + tickLength * Math.sin(perpAngle);
      const tick1x2 = x1 - tickLength * Math.cos(perpAngle);
      const tick1y2 = y1 - tickLength * Math.sin(perpAngle);
      
      const tick2x1 = x2 + tickLength * Math.cos(perpAngle);
      const tick2y1 = y2 + tickLength * Math.sin(perpAngle);
      const tick2x2 = x2 - tickLength * Math.cos(perpAngle);
      const tick2y2 = y2 - tickLength * Math.sin(perpAngle);
      
      const distanceText = distance < 100 
        ? `${distance.toFixed(0)} px` 
        : `${(distance / 100).toFixed(2)} m`;

      return (
        <G key={id}>
          <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} />
          <Line x1={tick1x1} y1={tick1y1} x2={tick1x2} y2={tick1y2} stroke={color} strokeWidth={sw} />
          <Line x1={tick2x1} y1={tick2y1} x2={tick2x2} y2={tick2y2} stroke={color} strokeWidth={sw} />
          <Rect
            x={midX - 35}
            y={midY - 12}
            width={70}
            height={24}
            fill="rgba(255,255,255,0.9)"
            rx={4}
          />
          <SvgText
            x={midX}
            y={midY + 5}
            fill="#333333"
            fontSize={12}
            fontWeight="bold"
            textAnchor="middle"
          >
            {distanceText}
          </SvgText>
        </G>
      );
    }

    return null;
  };

  return (
    <BackgroundView style={[styles.container, { backgroundColor: "#1a1a1a" }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.1)" }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {file.originalName}
        </ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.1)" }]}
            onPress={handleUndo}
            disabled={elements.length === 0}
          >
            <Feather name="rotate-ccw" size={20} color={elements.length ? "#FFFFFF" : "#666"} />
          </Pressable>
          <Pressable
            style={[styles.saveButton, { backgroundColor: BrandColors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="save" size={18} color="#FFFFFF" />
                <ThemedText style={styles.saveText}>Save</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.canvasContainer} onLayout={handleCanvasLayout}>
          <Animated.View style={animatedCanvasStyle}>
            <ViewShot
              ref={viewShotRef}
              style={[styles.viewShot, { width: canvasWidth, height: canvasHeight }]}
              options={{ 
                format: "png", 
                quality: 1, 
                result: "tmpfile",
                width: canvasWidth > 0 ? canvasWidth : undefined,
                height: canvasHeight > 0 ? canvasHeight : undefined,
              }}
            >
              <View style={{ width: canvasWidth, height: canvasHeight }}>
                <CrossPlatformImage
                  source={{ uri: signedUrl }}
                  style={[styles.backgroundImage, { width: canvasWidth, height: canvasHeight }]}
                  contentFit="contain"
                  onLoad={() => setImageLoaded(true)}
                  onError={handleImageError}
                />
                <Svg style={StyleSheet.absoluteFill} width={canvasWidth} height={canvasHeight}>
                  {elements.map(renderElement)}
                  {currentElement ? renderElement(currentElement) : null}
                </Svg>
              </View>
            </ViewShot>
          </Animated.View>
          {isZoomMode ? (
            <View style={styles.zoomHint}>
              <ThemedText style={styles.zoomHintText}>
                Pinch to zoom, drag to pan, double-tap to reset
              </ThemedText>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {showToolbar ? (
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.toolRow}>
            <Pressable
              style={[
                styles.toolButton,
                isZoomMode && { backgroundColor: BrandColors.primary },
              ]}
              onPress={() => setIsZoomMode(!isZoomMode)}
            >
              <Feather
                name={isZoomMode ? "zoom-out" : "zoom-in"}
                size={20}
                color={isZoomMode ? "#FFFFFF" : "#AAAAAA"}
              />
            </Pressable>
            <View style={styles.toolDivider} />
            {TOOLS.map((tool) => (
              <Pressable
                key={tool.type}
                style={[
                  styles.toolButton,
                  selectedTool === tool.type && !isZoomMode && { backgroundColor: selectedColor },
                  isZoomMode && { opacity: 0.5 },
                ]}
                onPress={() => {
                  if (isZoomMode) setIsZoomMode(false);
                  setSelectedTool(tool.type);
                }}
                disabled={isZoomMode}
              >
                <Feather
                  name={tool.icon as any}
                  size={20}
                  color={selectedTool === tool.type && !isZoomMode ? "#FFFFFF" : "#AAAAAA"}
                />
              </Pressable>
            ))}
            <View style={styles.toolDivider} />
            <Pressable
              style={[styles.toolButton, { backgroundColor: "rgba(255,0,0,0.2)" }]}
              onPress={handleClear}
            >
              <Feather name="trash-2" size={20} color="#FF6B6B" />
            </Pressable>
          </View>

          <View style={styles.colorRow}>
            {ANNOTATION_COLORS.map((c) => (
              <Pressable
                key={c.key}
                style={[
                  styles.colorButton,
                  { backgroundColor: c.hex },
                  selectedColor === c.hex && styles.colorButtonSelected,
                ]}
                onPress={() => setSelectedColor(c.hex)}
              />
            ))}
            <View style={styles.toolDivider} />
            {STROKE_WIDTHS.map((sw) => (
              <Pressable
                key={sw}
                style={[
                  styles.strokeButton,
                  strokeWidth === sw && { backgroundColor: "rgba(255,255,255,0.2)" },
                ]}
                onPress={() => setStrokeWidth(sw)}
              >
                <View
                  style={[
                    styles.strokePreview,
                    { height: sw, backgroundColor: selectedColor },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        style={[styles.toggleToolbar, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowToolbar(!showToolbar)}
      >
        <Feather name={showToolbar ? "chevron-down" : "chevron-up"} size={20} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showTextModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTextModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Add Text Annotation
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Enter annotation text..."
              placeholderTextColor={theme.textTertiary}
              autoFocus
              multiline
              maxLength={100}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowTextModal(false)}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: BrandColors.primary }]}
                onPress={handleAddText}
              >
                <ThemedText style={{ color: "#FFFFFF" }}>Add</ThemedText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitle: {
    flex: 1,
    ...Typography.bodyBold,
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  saveText: {
    ...Typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  viewShot: {
    backgroundColor: "#000",
  },
  zoomHint: {
    position: "absolute",
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  zoomHintText: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  backgroundImage: {
    position: "absolute",
  },
  toolbar: {
    backgroundColor: "#2a2a2a",
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  toolButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  toolDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: Spacing.sm,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorButtonSelected: {
    borderColor: "#FFFFFF",
    borderWidth: 3,
  },
  strokeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  strokePreview: {
    width: 24,
    borderRadius: 2,
  },
  toggleToolbar: {
    position: "absolute",
    right: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    textAlign: "center",
  },
  modalInput: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
