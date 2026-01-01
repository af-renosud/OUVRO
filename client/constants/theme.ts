import { Platform } from "react-native";

const primaryLight = "#2563EB";
const primaryDark = "#60A5FA";

export const BrandColors = {
  primary: "#2563EB",
  primaryDark: "#1E40AF",
  primaryLight: "#60A5FA",
  secondary: "#059669",
  secondaryDark: "#047857",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  annotationRed: "#EF4444",
  annotationYellow: "#FBBF24",
  annotationBlack: "#111827",
};

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: primaryLight,
    link: primaryLight,
    primary: primaryLight,
    primaryDark: "#1E40AF",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F9FAFB",
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
    border: "#E5E7EB",
    surface: "#FFFFFF",
    success: BrandColors.success,
    warning: BrandColors.warning,
    error: BrandColors.error,
    info: BrandColors.info,
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: primaryDark,
    link: primaryDark,
    primary: primaryDark,
    primaryDark: "#3B82F6",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
    border: "#374151",
    surface: "#1F2937",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  inputHeight: 48,
  buttonHeight: 56,
  touchTarget: 48,
  touchTargetLarge: 56,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 34,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 17,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 17,
    fontWeight: "400" as const,
  },
  bodySmall: {
    fontSize: 15,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 17,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 4,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
