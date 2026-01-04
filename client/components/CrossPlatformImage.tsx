import React from "react";
import { Platform, Image as RNImage, ImageStyle, StyleProp, NativeSyntheticEvent, ImageLoadEventData, ImageErrorEventData, View } from "react-native";
import { Image as ExpoImage, ImageContentFit } from "expo-image";

type CrossPlatformImageProps = {
  source: any;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onLoad?: () => void;
  onError?: (error?: any) => void;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
};

export function CrossPlatformImage({
  source,
  style,
  contentFit = "contain",
  resizeMode,
  onLoad,
  onError,
  pointerEvents,
}: CrossPlatformImageProps) {
  if (Platform.OS === "web") {
    const rnResizeMode = resizeMode || (contentFit as any) || "contain";
    return (
      <View style={style} pointerEvents={pointerEvents}>
        <RNImage
          source={source}
          style={{ width: "100%", height: "100%" }}
          resizeMode={rnResizeMode}
          onLoad={onLoad ? () => onLoad() : undefined}
          onError={onError ? (e: NativeSyntheticEvent<ImageErrorEventData>) => onError(e.nativeEvent.error) : undefined}
        />
      </View>
    );
  }

  return (
    <View style={style} pointerEvents={pointerEvents}>
      <ExpoImage
        source={source}
        style={{ width: "100%", height: "100%" }}
        contentFit={contentFit}
        onLoad={onLoad}
        onError={onError}
      />
    </View>
  );
}
