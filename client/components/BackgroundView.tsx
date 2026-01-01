import React from "react";
import { View, Image, StyleSheet, type ViewProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export type BackgroundViewProps = ViewProps & {
  showTexture?: boolean;
};

export function BackgroundView({
  style,
  showTexture = false,
  children,
  ...otherProps
}: BackgroundViewProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={[{ backgroundColor: theme.backgroundRoot, flex: 1 }, style]} {...otherProps}>
      {showTexture ? (
        <Image
          source={require("../../assets/images/background-texture.png")}
          style={[
            StyleSheet.absoluteFill,
            styles.backgroundImage,
            { opacity: isDark ? 0.03 : 0.06 },
          ]}
          resizeMode="cover"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
});
