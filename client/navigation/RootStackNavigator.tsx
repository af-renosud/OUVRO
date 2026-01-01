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
import { useScreenOptions } from "@/hooks/useScreenOptions";

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
  PhotoCapture: { projectId: number };
  VideoCapture: { projectId: number };
  AudioCapture: { projectId: number };
  ObservationDetails: { projectId: number; mediaItems?: MediaItem[] };
  ProjectDetail: { projectId: number };
  ShareModal: { observation: ShareObservation; projectName: string; contractorName?: string };
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
        options={{
          presentation: "modal",
          headerTitle: "New Observation",
        }}
      />
      <Stack.Screen
        name="PhotoCapture"
        component={PhotoCaptureScreen}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VideoCapture"
        component={VideoCaptureScreen}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AudioCapture"
        component={AudioCaptureScreen}
        options={{
          presentation: "modal",
          headerTitle: "Record Narration",
        }}
      />
      <Stack.Screen
        name="ObservationDetails"
        component={ObservationDetailsScreen}
        options={{
          presentation: "modal",
          headerTitle: "Observation Details",
        }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{
          headerTitle: "Project",
        }}
      />
      <Stack.Screen
        name="ShareModal"
        component={ShareModalScreen}
        options={{
          presentation: "modal",
          headerTitle: "Share Observation",
        }}
      />
    </Stack.Navigator>
  );
}
