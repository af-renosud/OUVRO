import React from "react";
import { View, StyleSheet, Image } from "react-native";

export function HeaderTitle() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/ouvro-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 56,
  },
});
