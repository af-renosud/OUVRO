import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import CaptureModalScreen from "@/screens/CaptureModalScreen";
import PhotoCaptureScreen from "@/screens/PhotoCaptureScreen";
import VideoCaptureScreen from "@/screens/VideoCaptureScreen";
import AudioCaptureScreen from "@/screens/AudioCaptureScreen";
import ObservationDetailsScreen from "@/screens/ObservationDetailsScreen";
import ProjectDetailScreen from "@/screens/ProjectDetailScreen";
import ProjectAssetHubScreen from "@/screens/ProjectAssetHubScreen";
import ShareModalScreen from "@/screens/ShareModalScreen";
import FileViewerScreen from "@/screens/FileViewerScreen";
import AnnotationScreen from "@/screens/AnnotationScreen";
import ProjectFilesScreen from "@/screens/ProjectFilesScreen";
import DQEBrowserScreen from "@/screens/DQEBrowserScreen";
import ProjectLinksScreen from "@/screens/ProjectLinksScreen";
import PlansScreen from "@/screens/PlansScreen";
import DocsScreen from "@/screens/DocsScreen";
import FichesScreen from "@/screens/FichesScreen";
import TaskCaptureScreen from "@/screens/TaskCaptureScreen";
import VoiceTaskScreen from "@/screens/VoiceTaskScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import type { FileCategory, ProjectFile, ProjectLink, DQEItem } from "@/lib/archidoc-api";

export type ShareObservation = {
  id: number;
  title: string;
  description?: string;
  transcription?: string;
  translatedText?: string;
  mediaItems?: MediaItem[];
};

export type RootStackParamList = {
  Main: undefined;
  CaptureModal: undefined;
  PhotoCapture: { projectId: string; projectName?: string };
  VideoCapture: { projectId: string; projectName?: string };
  AudioCapture: { projectId: string; projectName?: string };
  TaskCapture: { projectId: string; projectName: string };
  VoiceTask: { projectId: string; projectName: string };
  ObservationDetails: { projectId: string; projectName?: string; mediaItems?: MediaItem[] };
  ProjectDetail: { projectId: string };
  ProjectAssetHub: { projectId: string };
  ShareModal: { observation: ShareObservation; projectName: string; contractorName?: string };
  FileViewer: { file: ProjectFile; signedUrl: string; projectId?: string };
  Annotation: { file: ProjectFile; signedUrl: string; projectId: string };
  ProjectFiles: { projectId: string; projectName: string };
  DQEBrowser: { projectId: string; projectName: string };
  ProjectLinks: { projectId: string; projectName: string; links: ProjectLink[] };
  PlansScreen: { projectId: string; projectName: string };
  DocsScreen: { projectId: string; projectName: string };
  FichesScreen: { projectId: string; projectName: string; items: DQEItem[] };
};

export type MediaItem = {
  type: "photo" | "video" | "audio";
  uri: string;
  duration?: number;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CaptureModal"
        component={CaptureModalScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="PhotoCapture"
        component={PhotoCaptureScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="VideoCapture"
        component={VideoCaptureScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="AudioCapture"
        component={AudioCaptureScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="TaskCapture"
        component={TaskCaptureScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="VoiceTask"
        component={VoiceTaskScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="ObservationDetails"
        component={ObservationDetailsScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
      />
      <Stack.Screen
        name="ProjectAssetHub"
        component={ProjectAssetHubScreen}
        options={{ headerTitle: "" }}
      />
      <Stack.Screen
        name="ShareModal"
        component={ShareModalScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="FileViewer"
        component={FileViewerScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="Annotation"
        component={AnnotationScreen}
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="ProjectFiles"
        component={ProjectFilesScreen}
        options={{ headerTitle: "Project Files" }}
      />
      <Stack.Screen
        name="DQEBrowser"
        component={DQEBrowserScreen}
        options={{ headerTitle: "DQE" }}
      />
      <Stack.Screen
        name="ProjectLinks"
        component={ProjectLinksScreen}
        options={{ headerTitle: "Liens Projet" }}
      />
      <Stack.Screen
        name="PlansScreen"
        component={PlansScreen}
        options={{ headerTitle: "Plans & Dessins" }}
      />
      <Stack.Screen
        name="DocsScreen"
        component={DocsScreen}
        options={{ headerTitle: "Documents" }}
      />
      <Stack.Screen
        name="FichesScreen"
        component={FichesScreen}
        options={{ headerTitle: "Fiches Techniques" }}
      />
    </Stack.Navigator>
  );
}
