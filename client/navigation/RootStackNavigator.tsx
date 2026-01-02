import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import CaptureModalScreen from "@/screens/CaptureModalScreen";
import PhotoCaptureScreen from "@/screens/PhotoCaptureScreen";
import VideoCaptureScreen from "@/screens/VideoCaptureScreen";
import AudioCaptureScreen from "@/screens/AudioCaptureScreen";
import ObservationDetailsScreen from "@/screens/ObservationDetailsScreen";
import ProjectDetailScreen from "@/screens/ProjectDetailScreen";
import ShareModalScreen from "@/screens/ShareModalScreen";
import FileViewerScreen from "@/screens/FileViewerScreen";
import AnnotationScreen from "@/screens/AnnotationScreen";
import ProjectFilesScreen from "@/screens/ProjectFilesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import type { FileCategory, ProjectFile } from "@/lib/archidoc-api";

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
  PhotoCapture: { projectId: string };
  VideoCapture: { projectId: string };
  AudioCapture: { projectId: string };
  ObservationDetails: { projectId: string; mediaItems?: MediaItem[] };
  ProjectDetail: { projectId: string };
  ShareModal: { observation: ShareObservation; projectName: string; contractorName?: string };
  FileViewer: { file: ProjectFile; signedUrl: string };
  Annotation: { file: ProjectFile; signedUrl: string; projectId: string };
  ProjectFiles: { projectId: string; projectName: string };
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
        name="ObservationDetails"
        component={ObservationDetailsScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
      />
      <Stack.Screen
        name="ShareModal"
        component={ShareModalScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="FileViewer"
        component={FileViewerScreen}
        options={{ presentation: "modal", headerTitle: "View File" }}
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
    </Stack.Navigator>
  );
}
