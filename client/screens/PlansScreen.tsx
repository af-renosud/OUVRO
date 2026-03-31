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

type PlansScreenRouteProp = RouteProp<RootStackParamList, "PlansScreen">;

export default function PlansScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const route = useRoute<PlansScreenRouteProp>();
  const { projectId, projectName } = route.params;

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.titleContainer}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Plans & Dessins
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {projectName}
          </ThemedText>
        </View>
        <ProjectFileBrowser
          projectId={projectId}
          category="plans"
          emptyIcon="map"
          emptyTitle="Aucun plan disponible"
          emptyText="Les plans et dessins de ce projet n'ont pas encore été ajoutés."
          loadingText="Chargement des plans..."
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
    paddingBottom: Spacing.md,
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
