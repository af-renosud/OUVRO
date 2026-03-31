import React from "react";
import { View, StyleSheet } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography } from "@/constants/theme";
import { ProjectFileBrowser } from "@/components/ProjectFileBrowser";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type DocsScreenRouteProp = RouteProp<RootStackParamList, "DocsScreen">;

export default function DocsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const route = useRoute<DocsScreenRouteProp>();
  const { projectId, projectName } = route.params;

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.titleContainer}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Documents Généraux
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {projectName}
          </ThemedText>
        </View>
        <ProjectFileBrowser
          projectId={projectId}
          category="general"
          emptyIcon="file-text"
          emptyTitle="Aucun document"
          emptyText="Les documents généraux de ce projet n'ont pas encore été ajoutés."
          loadingText="Chargement des documents..."
          style={styles.browser}
        />
      </View>
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  browser: {
    flex: 1,
  },
});
