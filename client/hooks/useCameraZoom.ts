import { useCallback, useMemo, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";

/**
 * Shared pinch-to-zoom state for expo-camera CameraView.
 *
 * CameraView's `zoom` prop expects a value between 0 (no zoom) and 1 (max
 * zoom). The pinch scale is mapped onto that range with a sensitivity factor
 * so a full pinch travels a comfortable portion of the zoom range.
 *
 * Usage:
 *   const { zoom, pinchGesture, resetZoom } = useCameraZoom();
 *   <GestureDetector gesture={pinchGesture}>
 *     <CameraView zoom={zoom} ... />
 *   </GestureDetector>
 * Call `resetZoom()` when switching lenses/facing so the new camera starts
 * at its natural field of view.
 */

const PINCH_SENSITIVITY = 0.35;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function useCameraZoom() {
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const baseZoomRef = useRef(0);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
          baseZoomRef.current = zoomRef.current;
        })
        .onUpdate((event) => {
          const next = clamp01(
            baseZoomRef.current + (event.scale - 1) * PINCH_SENSITIVITY,
          );
          zoomRef.current = next;
          setZoom(next);
        }),
    [],
  );

  const resetZoom = useCallback(() => {
    baseZoomRef.current = 0;
    zoomRef.current = 0;
    setZoom(0);
  }, []);

  return { zoom, pinchGesture, resetZoom };
}
