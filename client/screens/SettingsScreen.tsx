import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type SettingsItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
};

export default function SettingsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoSync, setAutoSync] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState<"english" | "french">("english");

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {} },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "Type DELETE to confirm account deletion",
              [{ text: "Cancel", style: "cancel" }]
            );
          },
        },
      ]
    );
  };

  const settingsGroups: { title: string; items: SettingsItem[] }[] = [
    {
      title: "Profile",
      items: [
        {
          icon: "user",
          label: "Account",
          value: "architect@example.com",
          onPress: () => {},
        },
      ],
    },
    {
      title: "Sync Preferences",
      items: [
        {
          icon: "wifi",
          label: "WiFi Only",
          hasToggle: true,
          toggleValue: wifiOnly,
          onToggle: setWifiOnly,
        },
        {
          icon: "refresh-cw",
          label: "Auto Sync",
          hasToggle: true,
          toggleValue: autoSync,
          onToggle: setAutoSync,
        },
      ],
    },
    {
      title: "Language",
      items: [
        {
          icon: "globe",
          label: "Default Language",
          value: defaultLanguage === "english" ? "English" : "French",
          onPress: () => {
            Alert.alert("Select Language", "", [
              { text: "English", onPress: () => setDefaultLanguage("english") },
              { text: "French", onPress: () => setDefaultLanguage("french") },
              { text: "Cancel", style: "cancel" },
            ]);
          },
        },
      ],
    },
    {
      title: "About",
      items: [
        { icon: "info", label: "Version", value: "1.0.1" },
        { icon: "file-text", label: "Terms of Service", onPress: () => {} },
        { icon: "shield", label: "Privacy Policy", onPress: () => {} },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: "log-out", label: "Log Out", onPress: handleLogout },
        {
          icon: "trash-2",
          label: "Delete Account",
          onPress: handleDeleteAccount,
          danger: true,
        },
      ],
    },
  ];

  const renderSettingsItem = (item: SettingsItem, index: number, isLast: boolean) => (
    <Pressable
      key={index}
      style={({ pressed }) => [
        styles.settingsItem,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
        pressed && styles.pressed,
      ]}
      onPress={item.onPress}
      disabled={item.hasToggle}
    >
      <View style={[styles.iconContainer, item.danger && { backgroundColor: "#FEE2E2" }]}>
        <Feather
          name={item.icon}
          size={20}
          color={item.danger ? BrandColors.error : BrandColors.primary}
        />
      </View>
      <ThemedText style={[styles.itemLabel, item.danger && { color: BrandColors.error }]}>
        {item.label}
      </ThemedText>
      {item.hasToggle ? (
        <Switch
          value={item.toggleValue}
          onValueChange={item.onToggle}
          trackColor={{ false: theme.backgroundTertiary, true: BrandColors.primary }}
          thumbColor="#FFFFFF"
        />
      ) : item.value ? (
        <ThemedText style={[styles.itemValue, { color: theme.textSecondary }]}>
          {item.value}
        </ThemedText>
      ) : (
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      )}
    </Pressable>
  );

  return (
    <BackgroundView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: Math.max(tabBarHeight, 80) + 160 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandingContainer}>
          <Image
            source={require("../../assets/images/ouvro-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        {settingsGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.settingsGroup}>
            <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>
              {group.title}
            </ThemedText>
            <Card style={styles.groupCard}>
              {group.items.map((item, index) =>
                renderSettingsItem(item, index, index === group.items.length - 1)
              )}
            </Card>
          </View>
        ))}
      </ScrollView>
    </BackgroundView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  brandingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  logo: {
    width: 207,
    height: 64,
  },
  settingsGroup: {
    marginBottom: Spacing.lg,
  },
  groupTitle: {
    ...Typography.label,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  groupCard: {
    padding: 0,
    overflow: "hidden",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    ...Typography.body,
    flex: 1,
  },
  itemValue: {
    ...Typography.bodySmall,
  },
  pressed: {
    opacity: 0.7,
  },
});
