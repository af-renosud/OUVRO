import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ProjectsScreen from "@/screens/ProjectsScreen";
import QueueScreen from "@/screens/QueueScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Shadows, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "./RootStackNavigator";

export type MainTabParamList = {
  ProjectsTab: undefined;
  QueueTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function CaptureButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDark } = useTheme();
  
  const currentRoute = useNavigationState((state) => {
    const mainRoute = state?.routes?.find((r) => r.name === "Main");
    if (mainRoute?.state?.routes) {
      const index = mainRoute.state.index ?? 0;
      return mainRoute.state.routes[index]?.name;
    }
    return null;
  });

  if (currentRoute === "SettingsTab") {
    return null;
  }

  return (
    <View style={styles.fabContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: BrandColors.coralRed },
          pressed && styles.fabPressed,
        ]}
        onPress={() => navigation.navigate("CaptureModal")}
      >
        <Feather name="camera" size={34} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="ProjectsTab"
        screenOptions={{
          tabBarActiveTintColor: BrandColors.primary,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
            height: Platform.OS === "ios" ? 105 : 77,
            paddingBottom: Platform.OS === "ios" ? 32 : 10,
            paddingTop: 8,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "600",
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
        }}
      >
        <Tab.Screen
          name="ProjectsTab"
          component={ProjectsScreen}
          options={{
            title: "Projects",
            tabBarIcon: () => (
              <Feather name="home" size={28} color="#F59E0B" />
            ),
          }}
        />
        <Tab.Screen
          name="QueueTab"
          component={QueueScreen}
          options={{
            title: "Queue",
            tabBarIcon: () => (
              <Feather name="cloud" size={28} color="#F59E0B" />
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            title: "Settings",
            tabBarIcon: () => (
              <Feather name="settings" size={28} color="#F59E0B" />
            ),
          }}
        />
      </Tab.Navigator>
      <CaptureButton />
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 140 : 110,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  fab: {
    width: 77,
    height: 77,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.fab,
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
