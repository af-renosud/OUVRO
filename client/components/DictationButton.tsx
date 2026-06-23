import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, ActivityIndicator, Platform, Alert, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { apiRequest } from "@/lib/query-client";
import { ThemedText } from "@/components/ThemedText";
import { BrandColors, Spacing, BorderRadius } from "@/constants/theme";

type DictationButtonProps = {
  onTranscribed: (text: string) => void;
  language?: string;
};

export function DictationButton({ onTranscribed, language = "French" }: DictationButtonProps) {
  const {
    permissionStatus,
    isRecording,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    discardRecording,
    requestPermission,
    formatDuration,
  } = useAudioRecorder({ maxDurationSeconds: 120 });

  const [isTranscribing, setIsTranscribing] = useState(false);
  const pendingRef = useRef(false);

  const transcribe = async (uri: string) => {
    setIsTranscribing(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.includes(",") ? result.split(",")[1] : result);
        };
        reader.onerror = () => reject(new Error("Lecture audio impossible"));
        reader.readAsDataURL(blob);
      });

      const res = await apiRequest("POST", "/api/transcribe", {
        audioBase64: base64,
        mimeType: "audio/mp4",
        language,
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      const text = (result.transcription || "").trim();
      if (text) {
        onTranscribed(text);
      } else {
        Alert.alert("Dictée", "Aucun texte détecté. Réessayez.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Transcription impossible";
      Alert.alert("Dictée", msg);
    } finally {
      setIsTranscribing(false);
      discardRecording();
    }
  };

  useEffect(() => {
    if (pendingRef.current && recordingUri) {
      pendingRef.current = false;
      void transcribe(recordingUri);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingUri]);

  const handlePress = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Dictée", "Ouvrez l'application dans Expo Go pour dicter.");
      return;
    }
    if (isTranscribing) return;

    if (isRecording) {
      pendingRef.current = true;
      await stopRecording();
      return;
    }

    if (permissionStatus !== "granted") {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Microphone requis",
          "Autorisez l'accès au microphone pour dicter.",
          Platform.OS === "web"
            ? undefined
            : [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Réglages",
                  onPress: async () => {
                    try {
                      await Linking.openSettings();
                    } catch {
                      // openSettings not supported on this platform
                    }
                  },
                },
              ]
        );
        return;
      }
    }
    await startRecording();
  };

  let label = "Dicter";
  let iconName: keyof typeof Feather.glyphMap = "mic";
  if (isTranscribing) {
    label = "Transcription…";
  } else if (isRecording) {
    label = `Arrêter ${formatDuration(recordingDuration)}`;
    iconName = "square";
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isTranscribing}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isRecording ? BrandColors.error : BrandColors.primary,
          opacity: pressed || isTranscribing ? 0.7 : 1,
        },
      ]}
    >
      {isTranscribing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Feather name={iconName} size={16} color="#FFFFFF" />
      )}
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
