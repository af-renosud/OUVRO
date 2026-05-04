import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  InteractionManager,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";

const MIN_VISIBLE_MS = 600;
const FADE_OUT_MS = 350;
const SAFETY_TIMEOUT_MS = 8000;

type ColdStartOverlayProps = {
  ready?: boolean;
};

export function ColdStartOverlay({ ready = true }: ColdStartOverlayProps) {
  const [hidden, setHidden] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const mountedAt = useRef(Date.now()).current;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const dismiss = () => {
      if (cancelled) return;
      const elapsed = Date.now() - mountedAt;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      fadeTimer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }).start(() => {
          if (!cancelled) setHidden(true);
        });
      }, wait);
    };

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      removeTimer = setTimeout(dismiss, 0);
    });

    safetyTimer = setTimeout(dismiss, SAFETY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      interactionHandle?.cancel?.();
      if (fadeTimer) clearTimeout(fadeTimer);
      if (removeTimer) clearTimeout(removeTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [mountedAt, opacity, ready]);

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "auto"}
      style={[styles.overlay, { opacity }]}
    >
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/images/ouvro-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <ThemedText
          type="h2"
          style={styles.title}
          lightColor="#FFFFFF"
          darkColor="#FFFFFF"
        >
          OUVRO
        </ThemedText>

        <View style={styles.hintRow}>
          <Feather name="wifi-off" size={16} color="rgba(255,255,255,0.85)" />
          <ThemedText
            type="body"
            style={styles.hint}
            lightColor="#FFFFFF"
            darkColor="#FFFFFF"
          >
            Loading from your device — no signal needed
          </ThemedText>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BrandColors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    maxWidth: 360,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    color: "#FFFFFF",
    letterSpacing: 2,
    fontWeight: "700",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  hint: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
});
