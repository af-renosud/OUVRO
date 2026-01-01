import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ProjectsScreen from "@/screens/ProjectsScreen";
import QueueScreen from "@/screens/QueueScreen";
import FilesScreen from "@/screens/FilesScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Shadows, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "./RootStackNavigator";

export type MainTabParamList = {
  ProjectsTab: undefined;
  QueueTab: undefined;
  FilesTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function CaptureButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDark } = useTheme();

  return (
    <View style={styles.fabContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: BrandColors.primary },
          pressed && styles.fabPressed,
        ]}
        onPress={() => navigation.navigate("CaptureModal")}
      >
        <Feather name="camera" size={28} color="#FFFFFF" />
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
            height: Platform.OS === "ios" ? 88 : 64,
            paddingBottom: Platform.OS === "ios" ? 28 : 8,
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
            fontSize: 11,
            fontWeight: "500",
          },
        }}
      >
        <Tab.Screen
          name="ProjectsTab"
          component={ProjectsScreen}
          options={{
            title: "Projects",
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="QueueTab"
          component={QueueScreen}
          options={{
            title: "Queue",
            tabBarIcon: ({ color, size }) => (
              <Feather name="cloud" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="FilesTab"
          component={FilesScreen}
          options={{
            title: "Files",
            tabBarIcon: ({ color, size }) => (
              <Feather name="folder" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Feather name="settings" size={size} color={color} />
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
    bottom: Platform.OS === "ios" ? 44 : 20,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  fab: {
    width: 64,
    height: 64,
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
