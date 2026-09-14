import React, { useMemo } from 'react';
import { View, ViewProps, Platform, UIManager } from 'react-native';

export interface LinearGradientPoint {
  x: number;
  y: number;
}

export interface LinearGradientProps extends ViewProps {
  colors: readonly string[] | string[];
  locations?: readonly number[] | number[] | null;
  start?: LinearGradientPoint | [number, number] | null;
  end?: LinearGradientPoint | [number, number] | null;
  radialCSS?: string;
  radialPreset?: 'radial1' | 'radial2' | 'colorGrading';
  children?: React.ReactNode;
}

// Safely probe if native ExpoLinearGradient view manager is registered in UIManager
function probeNativeGradient(): React.ComponentType<LinearGradientProps> | null {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    const hasViewManager =
      typeof UIManager !== 'undefined' &&
      Boolean(
        UIManager.getViewManagerConfig?.('ExpoLinearGradient') ||
          (UIManager as any)?.hasViewManagerConfig?.('ExpoLinearGradient')
      );

    if (hasViewManager) {
      // Dynamic require avoids top-level native view registration error
      const exp = require('expo-linear-gradient');
      return exp.LinearGradient || null;
    }
  } catch (_err) {
    // Graceful fallback to View
  }
  return null;
}

const NativeGradient = probeNativeGradient();

const RADIAL_PRESETS = {
  radial1: 'radial-gradient(circle at 13% 67%, #48dbfb, #5f27cd)',
  radial2: 'radial-gradient(circle at 72% 48%, #c8d6e5, #54a0ff)',
  colorGrading: 'radial-gradient(circle at 13% 67%, rgba(72, 219, 251, 0.75), rgba(95, 39, 205, 0.55)), radial-gradient(circle at 72% 48%, #c8d6e5, #54a0ff)',
};

function calculateAngle(
  start?: LinearGradientPoint | [number, number] | null,
  end?: LinearGradientPoint | [number, number] | null
): number {
  const startX = Array.isArray(start) ? start[0] : start?.x ?? 0;
  const startY = Array.isArray(start) ? start[1] : start?.y ?? 0;
  const endX = Array.isArray(end) ? end[0] : end?.x ?? 0;
  const endY = Array.isArray(end) ? end[1] : end?.y ?? 1;

  const dx = endX - startX;
  const dy = endY - startY;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (angle < 0) angle += 360;
  return Math.round(angle);
}

export function LinearGradient({
  colors,
  locations,
  start,
  end,
  radialCSS,
  radialPreset,
  children,
  style,
  ...props
}: LinearGradientProps) {
  // If native view manager is available in the compiled binary, use native gradient
  if (NativeGradient && !radialCSS && !radialPreset) {
    return (
      <NativeGradient
        colors={colors}
        locations={locations}
        start={start}
        end={end}
        style={style}
        {...props}>
        {children}
      </NativeGradient>
    );
  }

  // Universal Web & Fallback Native View implementation
  const primaryColor = colors && colors.length > 0 ? colors[0] : '#48dbfb';
  const angle = useMemo(() => calculateAngle(start, end), [start, end]);

  const webStyle = useMemo(() => {
    if (Platform.OS !== 'web') return null;

    if (radialPreset && RADIAL_PRESETS[radialPreset]) {
      return { backgroundImage: RADIAL_PRESETS[radialPreset] };
    }

    if (radialCSS) {
      return { backgroundImage: radialCSS };
    }

    if (!colors || colors.length === 0) return null;

    return {
      backgroundImage: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
    };
  }, [colors, angle, radialCSS, radialPreset]);

  return (
    <View
      style={[
        { backgroundColor: primaryColor },
        webStyle as any,
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

export default LinearGradient;
