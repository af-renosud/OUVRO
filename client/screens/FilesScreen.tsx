import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, Modal, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { fetchArchidocProjects, isApiConfigured, type MappedProject } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type LinksDropdownItem = {
  key: string;
  label: string;
  icon: string;
  link?: string;
};

export default function FilesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [linksModalVisible, setLinksModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: fetchArchidocProjects,
    enabled: isApiConfigured(),
    staleTime: 1000 * 60 * 5,
  });

  const handlePlansPress = (project: MappedProject) => {
    navigation.navigate("PlansScreen", {
      projectId: project.id,
      projectName: project.name,
      plansDrawingsLink: project.plansDrawingsLink,
    });
  };

  const handleDQEPress = (project: MappedProject) => {
    navigation.navigate("DQEBrowser", {
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleDocsPress = (project: MappedProject) => {
    navigation.navigate("DocsScreen", {
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleLinksPress = (project: MappedProject) => {
    setSelectedProject(project);
    setLinksModalVisible(true);
  };

  const handleFichesPress = (project: MappedProject) => {
    navigation.navigate("FichesScreen", {
      projectId: project.id,
      projectName: project.name,
      items: project.items || [],
    });
  };

  const handleDrivePress = (project: MappedProject) => {
    if (project.googleDriveLink) {
      openExternalLink(project.googleDriveLink);
    } else {
      Alert.alert("Lien non configuré", "Le lien Google Drive n'est pas configuré pour ce projet.");
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Impossible d'ouvrir", "Ce lien ne peut pas être ouvert sur cet appareil.");
      }
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'ouvrir le lien.");
    }
  };

  const handleLinksItemPress = (item: LinksDropdownItem) => {
    setLinksModalVisible(false);
    if (item.link) {
      openExternalLink(item.link);
    } else {
      Alert.alert("Lien non configuré", `Le lien "${item.label}" n'est pas configuré pour ce projet.`);
    }
  };

  const getLinksDropdownItems = (project: MappedProject): LinksDropdownItem[] => [
    { key: "photos", label: "Photos du Site", icon: "camera", link: project.photoSiteLink },
    { key: "models3d", label: "Modèles 3D", icon: "box", link: project.models3dLink },
    { key: "scan3d", label: "Visite 3D", icon: "home", link: project.scan3dVisitLink },
  ];

  const hasAnyLinks = (project: MappedProject): boolean => {
    return !!(project.photoSiteLink || project.models3dLink || project.scan3dVisitLink);
  };

  const hasAnyFiches = (project: MappedProject): boolean => {
    return (project.items || []).some((item) => item.attachments && item.attachments.length > 0);
  };

  const renderProjectItem = ({ item }: { item: MappedProject }) => {
    const statusColor = item.status === "active" ? BrandColors.success : theme.textTertiary;
    const hasItems = item.items && item.items.length > 0;
    const hasLinks = hasAnyLinks(item);
    const hasFiches = hasAnyFiches(item);
    const hasDrive = !!item.googleDriveLink;

    return (
      <View style={[styles.projectCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.projectHeader}>
          <View style={[styles.projectIcon, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="folder" size={24} color={BrandColors.primary} />
          </View>
          <View style={styles.projectInfo}>
            <ThemedText style={[styles.projectName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            <ThemedText style={[styles.projectLocation, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.location || item.clientName}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </ThemedText>
          </View>
        </View>
        
        <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handlePlansPress(item)}
          >
            <Feather name="map" size={16} color={BrandColors.primary} />
            <ThemedText style={[styles.actionText, { color: BrandColors.primary }]}>
              PLANS
            </ThemedText>
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={[styles.actionButton, !hasItems && styles.actionDisabled]}
            onPress={() => handleDQEPress(item)}
            disabled={!hasItems}
          >
            <Feather name="list" size={16} color={hasItems ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasItems ? BrandColors.primary : theme.textTertiary }]}>
              DQE
            </ThemedText>
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={styles.actionButton}
            onPress={() => handleDocsPress(item)}
          >
            <Feather name="file-text" size={16} color={BrandColors.primary} />
            <ThemedText style={[styles.actionText, { color: BrandColors.primary }]}>
              DOCS
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
          <Pressable
            style={[styles.actionButton, !hasLinks && styles.actionDisabled]}
            onPress={() => handleLinksPress(item)}
            disabled={!hasLinks}
          >
            <Feather name="link" size={16} color={hasLinks ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasLinks ? BrandColors.primary : theme.textTertiary }]}>
              LINKS
            </ThemedText>
            <Feather name="chevron-down" size={12} color={hasLinks ? BrandColors.primary : theme.textTertiary} />
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={[styles.actionButton, !hasFiches && styles.actionDisabled]}
            onPress={() => handleFichesPress(item)}
            disabled={!hasFiches}
          >
            <Feather name="paperclip" size={16} color={hasFiches ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasFiches ? BrandColors.primary : theme.textTertiary }]}>
              FICHES
            </ThemedText>
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={[styles.actionButton, !hasDrive && styles.actionDisabled]}
            onPress={() => handleDrivePress(item)}
            disabled={!hasDrive}
          >
            <Feather name="hard-drive" size={16} color={hasDrive ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasDrive ? BrandColors.primary : theme.textTertiary }]}>
              DRIVE
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="folder" size={64} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        No Projects Found
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {isApiConfigured()
          ? "No projects available from ARCHIDOC"
          : "ARCHIDOC API is not configured"}
      </ThemedText>
    </View>
  );

  const renderLinksModal = () => {
    if (!selectedProject) return null;
    const items = getLinksDropdownItems(selectedProject);

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
                  name={item.icon as any}
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

  if (!isApiConfigured()) {
    return (
      <BackgroundView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.headerSpacer} />
          <Image
            source={require("../../assets/images/ouvro-logo.png")}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Feather name="cloud-off" size={64} color={theme.textTertiary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            Not Connected
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            ARCHIDOC API URL is not configured. Contact your administrator to set up the connection.
          </ThemedText>
        </View>
      </BackgroundView>
    );
  }

  if (error) {
    return (
      <BackgroundView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.headerSpacer} />
          <Image
            source={require("../../assets/images/ouvro-logo.png")}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color={theme.textTertiary} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            {(error as Error).message || "Failed to load projects"}
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
            onPress={() => refetch()}
          >
            <ThemedText style={styles.retryText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </BackgroundView>
    );
  }

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerSpacer} />
        <Image
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.titleContainer}>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          Project Files
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select a project to access files
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading projects...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl + 80 },
          ]}
          ListEmptyComponent={renderEmptyState}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {renderLinksModal()}
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  headerSpacer: {
    width: 44,
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
  projectCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    ...Typography.caption,
    fontWeight: "600",
    fontSize: 11,
  },
  actionDivider: {
    width: 1,
    height: 24,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...Typography.bodyBold,
    marginBottom: 2,
  },
  projectLocation: {
    ...Typography.caption,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.caption,
    fontSize: 11,
    textTransform: "capitalize",
  },
  separator: {
    height: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl * 3,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: "center",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
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
