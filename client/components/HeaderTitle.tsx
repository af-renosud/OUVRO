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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  logo: {
    width: 240,
    height: 67,
  },
});
