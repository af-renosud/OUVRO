import React from "react";
import { Platform, Image as RNImage, ImageStyle, StyleProp, NativeSyntheticEvent, ImageLoadEventData, ImageErrorEventData } from "react-native";
import { Image as ExpoImage, ImageContentFit } from "expo-image";

type CrossPlatformImageProps = {
  source: any;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onLoad?: () => void;
  onError?: (error?: any) => void;
};

export function CrossPlatformImage({
  source,
  style,
  contentFit = "contain",
  resizeMode,
  onLoad,
  onError,
}: CrossPlatformImageProps) {
  if (Platform.OS === "web") {
    const rnResizeMode = resizeMode || (contentFit as any) || "contain";
    return (
      <RNImage
        source={source}
        style={style}
        resizeMode={rnResizeMode}
        onLoad={onLoad ? () => onLoad() : undefined}
        onError={onError ? (e: NativeSyntheticEvent<ImageErrorEventData>) => onError(e.nativeEvent.error) : undefined}
      />
    );
  }

  return (
    <ExpoImage
      source={source}
      style={style}
      contentFit={contentFit}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
