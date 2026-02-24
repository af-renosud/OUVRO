import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrossPlatformImage } from "@/components/CrossPlatformImage";
import { Spacing } from "@/constants/theme";

interface OuvroScreenHeaderProps {
  onBack: () => void;
}

export function OuvroScreenHeader({ onBack }: OuvroScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerBackground, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <CrossPlatformImage
            source={require("../../assets/images/back-button.png")}
            style={styles.backButtonImage}
            contentFit="contain"
          />
        </Pressable>
        <CrossPlatformImage
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <View style={styles.backButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBackground: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonImage: {
    width: 28,
    height: 28,
  },
  logo: {
    width: 180,
    height: 56,
  },
});
