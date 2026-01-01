import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BrandColors } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
  subtitle?: string;
}

export function HeaderTitle({ title, subtitle }: HeaderTitleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <View style={styles.subtitleRow}>
            <Image
              source={require("../assets/af-logo.png")}
              style={styles.afLogo}
              resizeMode="contain"
            />
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  icon: {
    width: 36,
    height: 36,
    marginRight: Spacing.sm,
    borderRadius: 8,
  },
  textContainer: {
    flexDirection: "column",
  },
  title: {
    ...Typography.h3,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -2,
  },
  afLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  subtitle: {
    ...Typography.label,
  },
});
