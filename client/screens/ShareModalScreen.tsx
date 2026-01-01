import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as MailComposer from "expo-mail-composer";
import * as Contacts from "expo-contacts";
import * as Sharing from "expo-sharing";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type ShareModalRouteProp = RouteProp<RootStackParamList, "ShareModal">;

type Attachment = {
  id: string;
  type: "photo" | "video" | "audio";
  uri: string;
  selected: boolean;
};

type MatchedContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export default function ShareModalScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ShareModalRouteProp>();
  
  const { observation, projectName, contractorName } = route.params;
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MatchedContact | null>(null);
  const [contactsPermission, setContactsPermission] = useState<boolean>(false);

  useEffect(() => {
    if (observation.mediaItems) {
      setAttachments(
        observation.mediaItems.map((item: { type: string; uri: string }, index: number) => ({
          id: `media-${index}`,
          type: item.type as "photo" | "video" | "audio",
          uri: item.uri,
          selected: true,
        }))
      );
    }
  }, [observation.mediaItems]);

  useEffect(() => {
    if (contractorName) {
      requestContactsPermission();
    }
  }, [contractorName]);

  const requestContactsPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setContactsPermission(true);
      searchContacts();
    }
  };

  const searchContacts = async () => {
    if (!contractorName) return;
    
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      
      const searchTerms = contractorName.toLowerCase().split(" ");
      const matches = data.filter((contact: Contacts.Contact) => {
        const contactName = contact.name?.toLowerCase() || "";
        return searchTerms.some((term) => contactName.includes(term));
      });
      
      const formatted: MatchedContact[] = matches.slice(0, 5).map((contact: Contacts.Contact, index: number) => ({
        id: String(index),
        name: contact.name || "Unknown",
        email: contact.emails?.[0]?.email,
        phone: contact.phoneNumbers?.[0]?.number,
      }));
      
      setMatchedContacts(formatted);
      if (formatted.length === 1) {
        setSelectedContact(formatted[0]);
      }
    } catch (error) {
      console.log("Error fetching contacts:", error);
    }
  };

  const toggleAttachment = (id: string) => {
    setAttachments((prev) =>
      prev.map((att) =>
        att.id === id ? { ...att, selected: !att.selected } : att
      )
    );
  };

  const getSelectedAttachments = () => attachments.filter((a) => a.selected);

  const buildMessage = () => {
    const lines = [
      `Site Observation: ${observation.title}`,
      `Project: ${projectName}`,
      "",
    ];
    
    if (observation.description) {
      lines.push(observation.description, "");
    }
    
    if (observation.translatedText) {
      lines.push("(French Translation)", observation.translatedText, "");
    } else if (observation.transcription) {
      lines.push("(Transcription)", observation.transcription, "");
    }
    
    const selectedCount = getSelectedAttachments().length;
    if (selectedCount > 0) {
      lines.push(`Attachments: ${selectedCount} file(s)`);
    }
    
    return lines.join("\n");
  };

  const handleShareWhatsApp = async () => {
    const selectedFiles = getSelectedAttachments();
    const message = buildMessage();
    
    if (selectedFiles.length > 0 && await Sharing.isAvailableAsync()) {
      try {
        for (const file of selectedFiles) {
          await Sharing.shareAsync(file.uri, {
            mimeType: file.type === "photo" ? "image/jpeg" : 
                      file.type === "video" ? "video/mp4" : "audio/m4a",
            dialogTitle: `Share ${file.type} via WhatsApp`,
          });
        }
      } catch (error) {
        const phone = selectedContact?.phone?.replace(/\D/g, "") || "";
        const url = phone 
          ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
          : `whatsapp://send?text=${encodeURIComponent(message)}`;
        
        Linking.openURL(url).catch(() => {
          Alert.alert("Error", "WhatsApp is not installed on this device");
        });
      }
    } else {
      const phone = selectedContact?.phone?.replace(/\D/g, "") || "";
      const url = phone 
        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
        : `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      Linking.openURL(url).catch(() => {
        Alert.alert("Error", "WhatsApp is not installed on this device");
      });
    }
    
    navigation.goBack();
  };

  const handleShareSMS = async () => {
    const message = buildMessage();
    const phone = selectedContact?.phone || "";
    const url = phone 
      ? `sms:${phone}?body=${encodeURIComponent(message)}`
      : `sms:?body=${encodeURIComponent(message)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Unable to open SMS app");
    });
    
    navigation.goBack();
  };

  const handleShareEmail = async () => {
    const isAvailable = await MailComposer.isAvailableAsync();
    
    if (!isAvailable) {
      Alert.alert("Email Not Available", "Please configure an email account on this device");
      return;
    }
    
    const selectedFiles = getSelectedAttachments();
    const attachmentUris = selectedFiles.map((a) => a.uri);
    
    const subject = `Site Observation: ${observation.title} - ${projectName}`;
    const body = buildMessage();
    const recipients = selectedContact?.email ? [selectedContact.email] : [];
    
    try {
      await MailComposer.composeAsync({
        recipients,
        subject,
        body,
        attachments: attachmentUris,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to compose email");
    }
  };

  const getAttachmentIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "photo": return "image";
      case "video": return "video";
      case "audio": return "mic";
      default: return "file";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={BrandColors.primary} />
        </Pressable>
        <Image
          source={require("../../assets/images/ouvro-logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.section}>
          <Card style={styles.observationCard}>
            <ThemedText style={styles.observationTitle}>{observation.title}</ThemedText>
            <ThemedText style={[styles.projectName, { color: theme.textSecondary }]}>
              {projectName}
            </ThemedText>
          </Card>
        </View>

        {attachments.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Select Attachments</ThemedText>
            <View style={styles.attachmentsGrid}>
              {attachments.map((attachment) => (
                <Pressable
                  key={attachment.id}
                  style={[
                    styles.attachmentItem,
                    attachment.selected && styles.attachmentSelected,
                    { borderColor: attachment.selected ? BrandColors.primary : theme.border },
                  ]}
                  onPress={() => toggleAttachment(attachment.id)}
                >
                  {attachment.type === "photo" ? (
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                  ) : (
                    <View style={[styles.attachmentPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                      <Feather 
                        name={getAttachmentIcon(attachment.type)} 
                        size={32} 
                        color={BrandColors.primary} 
                      />
                    </View>
                  )}
                  <View style={[
                    styles.attachmentCheckbox,
                    { backgroundColor: attachment.selected ? BrandColors.primary : theme.backgroundSecondary }
                  ]}>
                    {attachment.selected ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <ThemedText style={styles.attachmentLabel}>
                    {attachment.type.charAt(0).toUpperCase() + attachment.type.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {contractorName ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Contractor</ThemedText>
            <ThemedText style={[styles.contractorHint, { color: theme.textSecondary }]}>
              Looking for: {contractorName}
            </ThemedText>
            
            {!contactsPermission ? (
              <Pressable
                style={[styles.permissionButton, { backgroundColor: BrandColors.primary }]}
                onPress={requestContactsPermission}
              >
                <Feather name="users" size={20} color="#FFFFFF" />
                <ThemedText style={styles.permissionButtonText}>
                  Allow Contact Access
                </ThemedText>
              </Pressable>
            ) : matchedContacts.length > 0 ? (
              <View style={styles.contactsList}>
                {matchedContacts.map((contact) => (
                  <Pressable
                    key={contact.id}
                    style={[
                      styles.contactItem,
                      selectedContact?.id === contact.id && styles.contactSelected,
                      { 
                        backgroundColor: selectedContact?.id === contact.id 
                          ? `${BrandColors.primary}20` 
                          : theme.backgroundSecondary 
                      },
                    ]}
                    onPress={() => setSelectedContact(contact)}
                  >
                    <View style={styles.contactInfo}>
                      <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
                      {contact.email ? (
                        <ThemedText style={[styles.contactDetail, { color: theme.textSecondary }]}>
                          {contact.email}
                        </ThemedText>
                      ) : null}
                      {contact.phone ? (
                        <ThemedText style={[styles.contactDetail, { color: theme.textSecondary }]}>
                          {contact.phone}
                        </ThemedText>
                      ) : null}
                    </View>
                    {selectedContact?.id === contact.id ? (
                      <Feather name="check-circle" size={24} color={BrandColors.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <ThemedText style={[styles.noContactsText, { color: theme.textTertiary }]}>
                No matching contacts found
              </ThemedText>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.shareButtons}>
            <Pressable
              style={[styles.shareButton, { backgroundColor: BrandColors.success }]}
              onPress={handleShareWhatsApp}
            >
              <Feather name="message-circle" size={24} color="#FFFFFF" />
              <ThemedText style={styles.shareButtonText}>WhatsApp</ThemedText>
            </Pressable>
            
            <Pressable
              style={[styles.shareButton, { backgroundColor: BrandColors.info }]}
              onPress={handleShareSMS}
            >
              <Feather name="message-square" size={24} color="#FFFFFF" />
              <ThemedText style={styles.shareButtonText}>SMS</ThemedText>
            </Pressable>
            
            <Pressable
              style={[styles.shareButton, { backgroundColor: BrandColors.primary }]}
              onPress={handleShareEmail}
            >
              <Feather name="mail" size={24} color="#FFFFFF" />
              <ThemedText style={styles.shareButtonText}>Email</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  headerSpacer: {
    width: 40,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  observationCard: {
    padding: Spacing.md,
  },
  observationTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  projectName: {
    ...Typography.body,
  },
  attachmentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  attachmentItem: {
    width: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    overflow: "hidden",
  },
  attachmentSelected: {
    borderWidth: 2,
  },
  attachmentImage: {
    width: "100%",
    height: 80,
    resizeMode: "cover",
  },
  attachmentPlaceholder: {
    width: "100%",
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentCheckbox: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentLabel: {
    ...Typography.label,
    textAlign: "center",
    paddingVertical: Spacing.xs,
  },
  contractorHint: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  permissionButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  contactsList: {
    gap: Spacing.sm,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactSelected: {
    borderWidth: 1,
    borderColor: BrandColors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "600",
  },
  contactDetail: {
    ...Typography.bodySmall,
  },
  noContactsText: {
    ...Typography.body,
    fontStyle: "italic",
  },
  shareButtons: {
    flexDirection: "column",
    gap: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  shareButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
});
