import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectAssetHub">;

type AssetButtonConfig = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
};

const assetButtons: AssetButtonConfig[] = [
  { id: "plans", label: "PLANS", icon: "map", color: "#0B2545", bgColor: "#E8F4FD" },
  { id: "dqe", label: "DQE", icon: "list", color: "#319795", bgColor: "#E6FFFA" },
  { id: "docs", label: "DOCS", icon: "file-text", color: "#6B7280", bgColor: "#F3F4F6" },
  { id: "links", label: "LINKS", icon: "link", color: "#F59E0B", bgColor: "#FEF3C7" },
  { id: "fiches", label: "FICHES", icon: "paperclip", color: "#8B5CF6", bgColor: "#EDE9FE" },
  { id: "drive", label: "DRIVE", icon: "hard-drive", color: "#10B981", bgColor: "#D1FAE5" },
];

type LinksDropdownItem = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  link?: string;
};

export default function ProjectAssetHubScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { projectId } = route.params;
  const [linksModalVisible, setLinksModalVisible] = useState(false);

  const { data: projects = [] } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  const project = projects.find((p) => p.id === projectId);

  const openExternalLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Impossible d'ouvrir", "Ce lien ne peut pas être ouvert sur cet appareil.");
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir le lien.");
    }
  };

  const getLinksDropdownItems = (): LinksDropdownItem[] => {
    if (!project) return [];
    return [
      { key: "photos", label: "Photos du Site", icon: "camera", link: project.photosUrl },
      { key: "models3d", label: "Modèles 3D", icon: "box", link: project.model3dUrl },
      { key: "scan3d", label: "Visite 3D", icon: "home", link: project.tour3dUrl },
    ];
  };

  const handleLinksItemPress = (item: LinksDropdownItem) => {
    setLinksModalVisible(false);
    if (item.link) {
      openExternalLink(item.link);
    } else {
      Alert.alert("Lien non configuré", `Le lien "${item.label}" n'est pas configuré pour ce projet.`);
    }
  };

  const handleButtonPress = (buttonId: string) => {
    if (!project) return;

    switch (buttonId) {
      case "plans":
        navigation.navigate("PlansScreen", {
          projectId: project.id,
          projectName: project.name,
        });
        break;
      case "dqe":
        navigation.navigate("DQEBrowser", {
          projectId: project.id,
          projectName: project.name,
        });
        break;
      case "docs":
        navigation.navigate("DocsScreen", {
          projectId: project.id,
          projectName: project.name,
        });
        break;
      case "links":
        setLinksModalVisible(true);
        break;
      case "fiches":
        navigation.navigate("FichesScreen", {
          projectId: project.id,
          projectName: project.name,
          items: project.items || [],
        });
        break;
      case "drive":
        if (project.googleDriveUrl) {
          openExternalLink(project.googleDriveUrl);
        } else {
          Alert.alert("Lien non configuré", "Le lien Google Drive n'est pas configuré pour ce projet.");
        }
        break;
    }
  };

  const isButtonEnabled = (buttonId: string): boolean => {
    if (!project) return false;
    switch (buttonId) {
      case "dqe":
        return (project.items?.length ?? 0) > 0;
      case "links":
        return !!(project.photosUrl || project.model3dUrl || project.tour3dUrl);
      case "fiches":
        return (project.items || []).some((item) => item.attachments && item.attachments.length > 0);
      case "drive":
        return !!project.googleDriveUrl;
      default:
        return true;
    }
  };

  const getStatusColor = (status: string | null) => {
    const s = status?.toUpperCase() || "";
    if (s.includes("PREPARATION") || s.includes("PENDING")) return BrandColors.warning;
    if (s.includes("COMPLETE") || s.includes("FINISHED")) return theme.textTertiary;
    if (s.includes("ACTIVE") || s.includes("PROGRESS")) return BrandColors.success;
    return BrandColors.info;
  };

  const renderLinksModal = () => {
    const items = getLinksDropdownItems();

    return (
      <Modal
        visible={linksModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinksModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLinksModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Liens Externes
            </ThemedText>
            {items.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.modalItem, !item.link && styles.modalItemDisabled]}
                onPress={() => handleLinksItemPress(item)}
                disabled={!item.link}
              >
                <Feather
                  name={item.icon}
                  size={20}
                  color={item.link ? BrandColors.primary : theme.textTertiary}
                />
                <ThemedText
                  style={[
                    styles.modalItemText,
                    { color: item.link ? theme.text : theme.textTertiary },
                  ]}
                >
                  {item.label}
                </ThemedText>
                <Feather
                  name="external-link"
                  size={16}
                  color={item.link ? theme.textSecondary : theme.textTertiary}
                />
              </Pressable>
            ))}
            <Pressable
              style={[styles.modalCloseButton, { backgroundColor: theme.backgroundTertiary }]}
              onPress={() => setLinksModalVisible(false)}
            >
              <ThemedText style={[styles.modalCloseText, { color: theme.text }]}>
                Fermer
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    );
  };

  if (!project) {
    return (
      <BackgroundView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: theme.textSecondary }}>Loading project...</ThemedText>
        </View>
      </BackgroundView>
    );
  }

  return (
    <BackgroundView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.projectHeader, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.projectIcon, { backgroundColor: BrandColors.primary + "15" }]}>
            <Feather name="briefcase" size={32} color={BrandColors.primary} />
          </View>
          <View style={styles.projectInfo}>
            <ThemedText style={[styles.projectName, { color: theme.text }]} numberOfLines={2}>
              {project.name}
            </ThemedText>
            {project.location ? (
              <ThemedText style={[styles.projectLocation, { color: theme.textSecondary }]} numberOfLines={1}>
                {project.location}
              </ThemedText>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
              <ThemedText style={styles.statusText}>
                {project.status || "Active"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.buttonsGrid}>
          {assetButtons.map((button) => {
            const enabled = isButtonEnabled(button.id);
            return (
              <Pressable
                key={button.id}
                style={({ pressed }) => [
                  styles.assetButton,
                  { backgroundColor: enabled ? button.bgColor : theme.backgroundTertiary },
                  pressed && enabled && styles.assetButtonPressed,
                  !enabled && styles.assetButtonDisabled,
                ]}
                onPress={() => handleButtonPress(button.id)}
                disabled={!enabled}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: enabled ? button.color + "20" : theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name={button.icon}
                    size={32}
                    color={enabled ? button.color : theme.textTertiary}
                  />
                </View>
                <ThemedText
                  style={[
                    styles.buttonLabel,
                    { color: enabled ? button.color : theme.textTertiary },
                  ]}
                >
                  {button.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {renderLinksModal()}
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  projectIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  projectLocation: {
    ...Typography.bodySmall,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 11,
    textTransform: "capitalize",
  },
  buttonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  assetButton: {
    width: "48%",
    aspectRatio: 1.1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  assetButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  assetButtonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    ...Typography.h3,
    fontWeight: "700",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalItemDisabled: {
    opacity: 0.5,
  },
  modalItemText: {
    ...Typography.body,
    flex: 1,
  },
  modalCloseButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  modalCloseText: {
    ...Typography.bodyBold,
  },
});
