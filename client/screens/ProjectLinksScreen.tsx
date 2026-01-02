import React from "react";
import { View, StyleSheet, Pressable, FlatList, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { ProjectLink } from "@/lib/archidoc-api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHeaderHeight } from "@react-navigation/elements";

function getLinkIcon(type?: string): string {
  if (!type) return "link";
  const t = type.toLowerCase();
  if (t.includes("drive") || t.includes("google")) return "hard-drive";
  if (t.includes("folder") || t.includes("dropbox")) return "folder";
  if (t.includes("doc") || t.includes("document")) return "file-text";
  if (t.includes("sheet") || t.includes("excel")) return "grid";
  if (t.includes("web") || t.includes("site")) return "globe";
  return "external-link";
}

export default function ProjectLinksScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RootStackParamList, "ProjectLinks">>();
  const { projectName, links } = route.params;

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Failed to open link:", error);
    }
  };

  const renderLinkItem = ({ item }: { item: ProjectLink }) => {
    const iconName = getLinkIcon(item.type);

    return (
      <Pressable
        style={[styles.linkItem, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => handleOpenLink(item.url)}
      >
        <View style={[styles.linkIcon, { backgroundColor: theme.backgroundTertiary }]}>
          <Feather name={iconName as any} size={24} color={BrandColors.primary} />
        </View>
        <View style={styles.linkInfo}>
          <ThemedText style={[styles.linkTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.linkUrl, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.url}
          </ThemedText>
        </View>
        <Feather name="external-link" size={20} color={theme.textTertiary} />
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="link" size={64} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        Aucun Lien
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Ce projet n'a pas encore de liens externes
      </ThemedText>
    </View>
  );

  return (
    <BackgroundView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        <FlatList
          data={links}
          keyExtractor={(item) => item.id}
          renderItem={renderLinkItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          ListEmptyComponent={renderEmptyState}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    ...Typography.bodyBold,
    marginBottom: 2,
  },
  linkUrl: {
    ...Typography.caption,
  },
  separator: {
    height: Spacing.sm,
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
});
