import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { RootStackParamList, MediaItem } from "@/navigation/RootStackNavigator";
import type { ProjectFile } from "@/lib/archidoc-api";

export default function ObservationDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ObservationDetails">>();
  const { projectId, mediaItems = [] } = route.params;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcription, setTranscription] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const lastTitleRef = useRef("");
  const lastDescriptionRef = useRef("");

  const detectAndRemoveDuplication = useCallback((text: string, prev: string): string => {
    const trimmedText = text.trim();
    if (trimmedText.length < 6) return text;
    
    const words = trimmedText.split(/\s+/);
    if (words.length < 2) return text;
    
    for (let splitPoint = Math.ceil(words.length / 2); splitPoint < words.length; splitPoint++) {
      const firstPart = words.slice(0, splitPoint).join(" ").toLowerCase();
      const secondPart = words.slice(splitPoint).join(" ").toLowerCase();
      
      if (firstPart.startsWith(secondPart) || secondPart.startsWith(firstPart.split(" ").slice(0, words.length - splitPoint).join(" "))) {
        return words.slice(0, splitPoint).join(" ");
      }
    }
    
    const trimmedPrev = prev.trim();
    if (trimmedPrev.length >= 3) {
      if (trimmedText === trimmedPrev + " " + trimmedPrev || trimmedText === trimmedPrev + trimmedPrev) {
        return trimmedPrev;
      }
      
      if (trimmedText.startsWith(trimmedPrev + " ")) {
        const remainder = trimmedText.slice(trimmedPrev.length + 1).trim();
        const prevWords = trimmedPrev.toLowerCase().split(/\s+/);
        const remainderWords = remainder.toLowerCase().split(/\s+/);
        
        if (remainderWords.length > 0 && remainderWords.length <= prevWords.length) {
          const matchCount = remainderWords.filter((word, i) => prevWords[i] === word).length;
          if (matchCount >= remainderWords.length * 0.6) {
            return trimmedPrev;
          }
        }
      }
    }
    
    return text;
  }, []);

  const handleTitleChange = useCallback((text: string) => {
    const prev = lastTitleRef.current;
    const cleaned = detectAndRemoveDuplication(text, prev);
    lastTitleRef.current = cleaned;
    setTitle(cleaned);
  }, [detectAndRemoveDuplication]);

  const handleDescriptionChange = useCallback((text: string) => {
    const prev = lastDescriptionRef.current;
    const cleaned = detectAndRemoveDuplication(text, prev);
    lastDescriptionRef.current = cleaned;
    setDescription(cleaned);
  }, [detectAndRemoveDuplication]);

  const createObservationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/observations", {
        projectId: 1,
        archidocProjectId: projectId,
        title: title || "Untitled Observation",
        description,
        transcription,
        translatedText,
        syncStatus: "pending",
      });
      const observation = await res.json();

      for (const media of mediaItems) {
        await apiRequest("POST", `/api/observations/${observation.id}/media`, {
          type: media.type,
          localUri: media.uri,
          duration: media.duration,
        });
      }

      return observation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations/pending"] });
      if (navigation.canGoBack()) {
        navigation.popToTop();
      }
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to save observation. Please try again.");
      console.error("Error creating observation:", error);
    },
  });

  const handleTranscribe = async () => {
    const audioItem = mediaItems.find((m: MediaItem) => m.type === "audio");
    if (!audioItem) {
      Alert.alert("No Audio", "No audio recording to transcribe");
      return;
    }

    setIsTranscribing(true);
    try {
      const response = await fetch(audioItem.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        try {
          const res = await apiRequest("POST", "/api/transcribe", { 
            audioBase64: base64,
            mimeType: "audio/mp4"
          });
          const result = await res.json();
          if (result.error) {
            throw new Error(result.error);
          }
          setTranscription(result.transcription);
        } catch (error: any) {
          Alert.alert("Transcription Error", error?.message || "Failed to transcribe audio");
          console.error("Transcription error:", error);
        } finally {
          setIsTranscribing(false);
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      setIsTranscribing(false);
      Alert.alert("Error", "Failed to process audio file");
    }
  };

  const handleTranslate = async () => {
    const textToTranslate = transcription || description;
    if (!textToTranslate) {
      Alert.alert("No Text", "No text available to translate");
      return;
    }

    setIsTranslating(true);
    try {
      const res = await apiRequest("POST", "/api/translate", { text: textToTranslate, targetLanguage: "French" });
      const result = await res.json();
      setTranslatedText(result.translation);
    } catch (error) {
      Alert.alert("Error", "Failed to translate text");
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a title for this observation");
      return;
    }
    createObservationMutation.mutate();
  };

  const getMediaIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "photo":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "mic";
      default:
        return "file";
    }
  };

  const handleAnnotatePhoto = (item: MediaItem, index: number) => {
    // Create a ProjectFile-like object for the annotation screen
    const file: ProjectFile = {
      objectId: `local-photo-${index}`,
      objectName: `photo-${index}.jpg`,
      originalName: `Photo ${index + 1}`,
      contentType: "image/jpeg",
      size: 0,
      projectId: projectId,
      category: "photos",
      createdAt: new Date().toISOString(),
    };
    
    navigation.navigate("Annotation", {
      file,
      signedUrl: item.uri,
      projectId,
    });
  };

  const hasAudio = mediaItems.some((m: MediaItem) => m.type === "audio");

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { 
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.section}>
          <ThemedText style={styles.label}>Title</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Enter observation title..."
            placeholderTextColor={theme.textTertiary}
            value={title}
            onChangeText={handleTitleChange}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Description</ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Describe what you observed..."
            placeholderTextColor={theme.textTertiary}
            value={description}
            onChangeText={handleDescriptionChange}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {mediaItems.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.label}>Attached Media</ThemedText>
            <ThemedText style={[styles.mediaHint, { color: theme.textSecondary }]}>
              Tap photos to annotate
            </ThemedText>
            <View style={styles.mediaGrid}>
              {mediaItems.map((item: MediaItem, index: number) => (
                <Pressable
                  key={index}
                  style={[styles.mediaThumbnail, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={item.type === "photo" ? () => handleAnnotatePhoto(item, index) : undefined}
                  disabled={item.type !== "photo"}
                >
                  {item.type === "photo" ? (
                    <>
                      <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                      <View style={styles.annotationOverlay}>
                        <Feather name="edit-2" size={16} color="#FFFFFF" />
                      </View>
                    </>
                  ) : (
                    <View style={styles.mediaIconContainer}>
                      <Feather name={getMediaIcon(item.type)} size={32} color={BrandColors.primary} />
                      {item.duration ? (
                        <ThemedText style={[styles.duration, { color: theme.textSecondary }]}>
                          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}
                        </ThemedText>
                      ) : null}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {hasAudio ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.label}>Transcription</ThemedText>
              <Pressable
                style={[styles.actionButton, { backgroundColor: BrandColors.primary }]}
                onPress={handleTranscribe}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="mic" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.actionButtonText}>Transcribe</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            {transcription ? (
              <Card style={styles.transcriptionCard}>
                <ThemedText style={styles.transcriptionText}>{transcription}</ThemedText>
              </Card>
            ) : (
              <ThemedText style={[styles.placeholder, { color: theme.textTertiary }]}>
                Tap "Transcribe" to convert your audio to text
              </ThemedText>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.label}>French Translation</ThemedText>
            <Pressable
              style={[styles.actionButton, { backgroundColor: BrandColors.accent }]}
              onPress={handleTranslate}
              disabled={isTranslating || (!transcription && !description)}
            >
              {isTranslating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="globe" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.actionButtonText}>Translate</ThemedText>
                </>
              )}
            </Pressable>
          </View>
          {translatedText ? (
            <Card style={styles.translationCard}>
              <ThemedText style={styles.translationText}>{translatedText}</ThemedText>
            </Card>
          ) : (
            <ThemedText style={[styles.placeholder, { color: theme.textTertiary }]}>
              Tap "Translate" to convert to French for contractors
            </ThemedText>
          )}
        </View>

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: BrandColors.primary },
            createObservationMutation.isPending && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={createObservationMutation.isPending}
        >
          {createObservationMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={20} color="#FFFFFF" />
              <ThemedText style={styles.saveButtonText}>Save Observation</ThemedText>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  mediaHint: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
    fontStyle: "italic",
  },
  input: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  mediaThumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  annotationOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaIconContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  duration: {
    ...Typography.label,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  transcriptionCard: {
    padding: Spacing.md,
  },
  transcriptionText: {
    ...Typography.body,
  },
  translationCard: {
    padding: Spacing.md,
    backgroundColor: "#F0FDF4",
  },
  translationText: {
    ...Typography.body,
  },
  placeholder: {
    ...Typography.bodySmall,
    fontStyle: "italic",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
