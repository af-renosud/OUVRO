import React from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
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

export default function FilesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: fetchArchidocProjects,
    enabled: isApiConfigured(),
    staleTime: 1000 * 60 * 5,
  });

  const handleFilesPress = (project: MappedProject) => {
    navigation.navigate("ProjectFiles", {
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleDQEPress = (project: MappedProject) => {
    navigation.navigate("DQEBrowser", {
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleLinksPress = (project: MappedProject) => {
    navigation.navigate("ProjectLinks", {
      projectId: project.id,
      projectName: project.name,
      links: project.links || [],
    });
  };

  const renderProjectItem = ({ item }: { item: MappedProject }) => {
    const statusColor = item.status === "active" ? BrandColors.success : theme.textTertiary;
    const hasItems = item.items && item.items.length > 0;
    const hasLinks = item.links && item.links.length > 0;

    return (
      <View style={[styles.projectCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Pressable
          style={styles.projectHeader}
          onPress={() => handleFilesPress(item)}
        >
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
        </Pressable>
        
        <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleFilesPress(item)}
          >
            <Feather name="file" size={18} color={BrandColors.primary} />
            <ThemedText style={[styles.actionText, { color: BrandColors.primary }]}>
              Fichiers
            </ThemedText>
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={[styles.actionButton, !hasItems && styles.actionDisabled]}
            onPress={() => handleDQEPress(item)}
            disabled={!hasItems}
          >
            <Feather name="list" size={18} color={hasItems ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasItems ? BrandColors.primary : theme.textTertiary }]}>
              DQE
            </ThemedText>
          </Pressable>
          
          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
          
          <Pressable
            style={[styles.actionButton, !hasLinks && styles.actionDisabled]}
            onPress={() => handleLinksPress(item)}
            disabled={!hasLinks}
          >
            <Feather name="link" size={18} color={hasLinks ? BrandColors.primary : theme.textTertiary} />
            <ThemedText style={[styles.actionText, { color: hasLinks ? BrandColors.primary : theme.textTertiary }]}>
              Liens
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
          Select a project to browse files
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
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    ...Typography.caption,
    fontWeight: "600",
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
});
