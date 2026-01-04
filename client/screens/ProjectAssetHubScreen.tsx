import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { fetchArchidocProjects, type MappedProject } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const DRIVE_BORDER_COLOR = "#EA4335";

function GoogleDriveIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 87.3 78" fill="none">
      <Path d="M6.6 66.85L0 56.5 27.6 10.9h18.3L6.6 66.85z" fill="#0066DA" />
      <Path d="M29.9 78l13.5-21.9h38.4l-13.5 21.9H29.9z" fill="#00AC47" />
      <Path d="M50.3 38l16.2 28h17.8L68.1 38 55.2 16.2H37.8L50.3 38z" fill="#FFBA00" />
    </Svg>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "ProjectAssetHub">;

type AssetButtonConfig = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
};

const BUTTON_BG_COLOR = "#0B2545";
const BUTTON_ICON_COLOR = "#F8FAFC";
const BUTTON_TEXT_COLOR = "#7E7F83";

const assetButtons: AssetButtonConfig[] = [
  { id: "plans", label: "PLANS", icon: "map", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
  { id: "dqe", label: "DQE", icon: "list", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
  { id: "docs", label: "DOCS", icon: "file-text", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
  { id: "links", label: "LINKS", icon: "link", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
  { id: "fiches", label: "FICHES", icon: "paperclip", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
  { id: "drive", label: "DRIVE", icon: "hard-drive", color: BUTTON_ICON_COLOR, bgColor: BUTTON_BG_COLOR },
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
  const headerHeight = useHeaderHeight();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { projectId } = route.params;
  const [linksModalVisible, setLinksModalVisible] = useState(false);

  const { data: projects = [] } = useQuery<MappedProject[]>({
    queryKey: ["archidoc-projects"],
    queryFn: fetchArchidocProjects,
  });

  const project = projects.find((p) => p.id === projectId);

  const availableHeight = height - insets.top - insets.bottom - 120;
  const availableWidth = width - Spacing.lg * 2;
  const buttonSize = Math.min((availableWidth - Spacing.lg) / 2, (availableHeight - Spacing.lg * 2) / 3) * 0.5;
  const iconSize = Math.min(buttonSize * 0.4, 24);

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
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.headerRow}>
          <ThemedText style={[styles.projectName, { color: theme.text }]} numberOfLines={1}>
            {project.name}
          </ThemedText>
        </View>

        <View style={styles.buttonsGrid}>
          {assetButtons.map((button) => {
            const enabled = isButtonEnabled(button.id);
            const isDrive = button.id === "drive";
            return (
              <View key={button.id} style={styles.buttonWrapper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.roundButton,
                    {
                      width: buttonSize,
                      height: buttonSize,
                      backgroundColor: isDrive ? "#FFFFFF" : BUTTON_BG_COLOR,
                      borderWidth: isDrive ? 3 : 0,
                      borderColor: isDrive ? DRIVE_BORDER_COLOR : "transparent",
                    },
                    pressed && enabled && styles.buttonPressed,
                  ]}
                  onPress={() => handleButtonPress(button.id)}
                  disabled={!enabled}
                >
                  {isDrive ? (
                    <GoogleDriveIcon size={buttonSize * 0.55} />
                  ) : (
                    <Feather
                      name={button.icon}
                      size={iconSize}
                      color={enabled ? BUTTON_ICON_COLOR : "#888888"}
                    />
                  )}
                </Pressable>
                <ThemedText
                  style={[
                    styles.buttonLabel,
                    { color: enabled ? BUTTON_TEXT_COLOR : theme.textTertiary },
                  ]}
                >
                  {button.label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>

      {renderLinksModal()}
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    alignItems: "center",
    marginBottom: Spacing.md * 1.5,
  },
  projectName: {
    ...Typography.h2,
    textAlign: "center",
    fontWeight: "700",
  },
  buttonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignContent: "flex-start",
    paddingTop: Spacing.sm,
  },
  buttonWrapper: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg * 2,
  },
  roundButton: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    ...Typography.label,
    fontWeight: "700",
    marginTop: Spacing.sm,
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
