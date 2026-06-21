import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ColdStartOverlay } from "@/components/ColdStartOverlay";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
import { OfflineTasksProvider } from "@/hooks/useOfflineTasks";
import { OfflineAnnotationsProvider } from "@/hooks/useOfflineAnnotations";
import { ProjectLockProvider } from "@/hooks/useProjectLock";
import { CaptureModeLockProvider } from "@/hooks/useCaptureModeLock";
import { DQESyncProvider } from "@/hooks/useDQESync";
import { SnagSyncProvider } from "@/hooks/useSnagSync";
import { SiteRemindersProvider } from "@/hooks/useSiteReminders";

const defaultHandler = (ErrorUtils as any).getGlobalHandler?.();
(ErrorUtils as any).setGlobalHandler?.((error: Error, isFatal?: boolean) => {
  console.error(`[OUVRO] ${isFatal ? "FATAL" : "Unhandled"} error:`, error?.message, error?.stack);
  if (defaultHandler) {
    defaultHandler(error, isFatal);
  }
});

export default function App() {
  const [navReady, setNavReady] = useState(false);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ProjectLockProvider>
        <CaptureModeLockProvider>
        <OfflineSyncProvider>
          <OfflineTasksProvider>
          <OfflineAnnotationsProvider>
          <DQESyncProvider>
          <SnagSyncProvider>
          <SiteRemindersProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <NavigationContainer onReady={() => setNavReady(true)}>
                  <RootStackNavigator />
                </NavigationContainer>
                <StatusBar style="auto" />
                <ColdStartOverlay ready={navReady} />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
          </SiteRemindersProvider>
          </SnagSyncProvider>
          </DQESyncProvider>
          </OfflineAnnotationsProvider>
          </OfflineTasksProvider>
        </OfflineSyncProvider>
        </CaptureModeLockProvider>
        </ProjectLockProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
