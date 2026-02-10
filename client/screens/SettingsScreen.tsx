import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BackgroundView } from "@/components/BackgroundView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { AUDIT_PROMPTS, type AuditType } from "@/lib/audit-prompts";

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
  const { settings, saveSettings, pendingCount, isNetworkAvailable } = useOfflineSync();
  const [defaultLanguage, setDefaultLanguage] = useState<"english" | "french">("english");
  const [expandedAudit, setExpandedAudit] = useState<AuditType | null>(null);
  const [copiedAudit, setCopiedAudit] = useState<AuditType | null>(null);

  const handleCopyPrompt = useCallback(async (auditId: AuditType, promptText: string) => {
    try {
      await Clipboard.setStringAsync(promptText);
      setCopiedAudit(auditId);
      setTimeout(() => setCopiedAudit(null), 2000);
    } catch {
      Alert.alert("Copy Failed", "Unable to copy to clipboard.");
    }
  }, []);

  const handleCopyAllPrompts = useCallback(async () => {
    try {
      const allPrompts = AUDIT_PROMPTS.map((a) => a.prompt).join("\n\n---\n\n");
      await Clipboard.setStringAsync(allPrompts);
      Alert.alert("Copied", "All 3 audit prompts copied to clipboard.");
    } catch {
      Alert.alert("Copy Failed", "Unable to copy to clipboard.");
    }
  }, []);

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
          toggleValue: settings.wifiOnly,
          onToggle: (value) => saveSettings({ wifiOnly: value }),
        },
        {
          icon: "refresh-cw",
          label: "Auto Sync",
          hasToggle: true,
          toggleValue: settings.autoSync,
          onToggle: (value) => saveSettings({ autoSync: value }),
        },
        {
          icon: "cloud",
          label: "Pending Observations",
          value: `${pendingCount} ${isNetworkAvailable ? "(Online)" : "(Offline)"}`,
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
        { icon: "file-text", label: "Terms of Service", onPress: () => Alert.alert("Terms of Service", "Terms of Service will be available at ouvro.com/terms") },
        { icon: "shield", label: "Privacy Policy", onPress: () => Alert.alert("Privacy Policy", "Privacy Policy will be available at ouvro.com/privacy") },
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

  const toggleAudit = (auditId: AuditType) => {
    setExpandedAudit((prev) => (prev === auditId ? null : auditId));
  };

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
          <HeaderTitle />
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

        <View style={styles.settingsGroup}>
          <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>
            PRE-DEPLOYMENT AUDITS
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.copyAllButton,
              { backgroundColor: BrandColors.primary },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleCopyAllPrompts}
          >
            <Feather name="copy" size={16} color="#FFFFFF" />
            <ThemedText style={styles.copyAllText}>Copy All 3 Audit Prompts</ThemedText>
          </Pressable>

          {AUDIT_PROMPTS.map((audit) => {
            const isExpanded = expandedAudit === audit.id;
            const isCopied = copiedAudit === audit.id;

            return (
              <Card key={audit.id} style={styles.auditCard}>
                <Pressable
                  style={({ pressed }) => [
                    styles.auditHeader,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toggleAudit(audit.id)}
                >
                  <View style={[styles.auditIconContainer, { backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF" }]}>
                    <Feather
                      name={audit.icon as keyof typeof Feather.glyphMap}
                      size={20}
                      color={BrandColors.primary}
                    />
                  </View>
                  <View style={styles.auditTitleContainer}>
                    <ThemedText style={styles.auditTitle}>{audit.title}</ThemedText>
                    <ThemedText style={[styles.auditDescription, { color: theme.textSecondary }]}>
                      {audit.description}
                    </ThemedText>
                  </View>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.textTertiary}
                  />
                </Pressable>

                {isExpanded ? (
                  <View style={styles.auditBody}>
                    <View style={[styles.auditDivider, { backgroundColor: theme.border }]} />

                    <Pressable
                      style={({ pressed }) => [
                        styles.copyButton,
                        {
                          backgroundColor: isCopied ? BrandColors.success : BrandColors.primary,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleCopyPrompt(audit.id, audit.prompt)}
                    >
                      <Feather
                        name={isCopied ? "check" : "clipboard"}
                        size={16}
                        color="#FFFFFF"
                      />
                      <ThemedText style={styles.copyButtonText}>
                        {isCopied ? "Copied!" : "Copy Prompt"}
                      </ThemedText>
                    </Pressable>

                    <View style={[styles.promptContainer, { backgroundColor: isDark ? "#0D1B2A" : "#F8FAFC" }]}>
                      <ScrollView
                        style={styles.promptScroll}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        <ThemedText style={[styles.promptText, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                          {audit.prompt}
                        </ThemedText>
                      </ScrollView>
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
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
    paddingBottom: Spacing.lg,
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
  copyAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  copyAllText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  auditCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  auditHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  auditIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  auditTitleContainer: {
    flex: 1,
  },
  auditTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  auditDescription: {
    ...Typography.caption,
    marginTop: 2,
  },
  auditBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  auditDivider: {
    height: 1,
    marginBottom: Spacing.sm,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  promptContainer: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    maxHeight: 300,
  },
  promptScroll: {
    maxHeight: 280,
  },
  promptText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 11,
    lineHeight: 16,
  },
});
