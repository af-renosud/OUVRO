import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Spacing, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";

type MediaType = "photo" | "video" | "audio";

type MediaOption = {
  type: MediaType;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
};

const mediaOptions: MediaOption[] = [
  {
    type: "photo",
    icon: "camera",
    title: "Photo",
    description: "Take a photo and annotate it",
  },
  {
    type: "video",
    icon: "video",
    title: "Video",
    description: "Record a video of the site",
  },
  {
    type: "audio",
    icon: "mic",
    title: "Audio",
    description: "Record voice narration",
  },
];

export default function CaptureModalScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);

  const { data: projects = [] } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject]);

  const handleMediaTypeSelect = (type: MediaType) => {
    const project = selectedProject || projects[0];
    if (!project) {
      Alert.alert("No Project", "Please wait for projects to load");
      return;
    }

    switch (type) {
      case "photo":
        navigation.navigate("PhotoCapture", { projectId: project.id });
        break;
      case "video":
        navigation.navigate("VideoCapture", { projectId: project.id });
        break;
      case "audio":
        navigation.navigate("AudioCapture", { projectId: project.id });
        break;
    }
  };

  const buttonSize = Math.min((height - 200) / 3.5, 140);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + Spacing.md }]}>
        <Image
          source={require("@assets/images/ouvro-logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.mediaGrid}>
          {mediaOptions.map((item) => (
            <Pressable
              key={item.type}
              style={({ pressed }) => [
                styles.mediaCardWrapper,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => handleMediaTypeSelect(item.type)}
            >
              <View style={[styles.iconCircle, { width: buttonSize, height: buttonSize }]}>
                <Feather name={item.icon} size={buttonSize * 0.45} color={BrandColors.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B2545",
  },
  headerBar: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  logo: {
    width: 180,
    height: 56,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  mediaGrid: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  mediaCardWrapper: {
    alignItems: "center",
  },
  iconCircle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6FFFA",
    borderWidth: 3,
    borderColor: "#0B2545",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
