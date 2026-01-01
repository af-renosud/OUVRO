import { Platform } from "react-native";

const primaryLight = "#4299E1";
const primaryDark = "#63B3ED";

export const BrandColors = {
  primary: "#4299E1",
  primaryDark: "#3182CE",
  primaryLight: "#63B3ED",
  secondary: "#63B3ED",
  secondaryDark: "#4299E1",
  accent: "#319795",
  accentLight: "#4FD1C5",
  neutral: "#4A5568",
  success: "#38A169",
  warning: "#DD6B20",
  error: "#E53E3E",
  info: "#4299E1",
  annotationRed: "#E53E3E",
  annotationYellow: "#ECC94B",
  annotationBlack: "#2D3748",
};

export const Colors = {
  light: {
    text: "#2D3748",
    textSecondary: "#4A5568",
    textTertiary: "#718096",
    buttonText: "#FFFFFF",
    tabIconDefault: "#718096",
    tabIconSelected: primaryLight,
    link: primaryLight,
    primary: primaryLight,
    primaryDark: "#3182CE",
    accent: "#319795",
    backgroundRoot: "#F7FAFC",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#EDF2F7",
    backgroundTertiary: "#E2E8F0",
    border: "#E2E8F0",
    surface: "#FFFFFF",
    success: BrandColors.success,
    warning: BrandColors.warning,
    error: BrandColors.error,
    info: BrandColors.info,
  },
  dark: {
    text: "#F7FAFC",
    textSecondary: "#A0AEC0",
    textTertiary: "#718096",
    buttonText: "#FFFFFF",
    tabIconDefault: "#718096",
    tabIconSelected: primaryDark,
    link: primaryDark,
    primary: primaryDark,
    primaryDark: "#4299E1",
    accent: "#4FD1C5",
    backgroundRoot: "#1A202C",
    backgroundDefault: "#2D3748",
    backgroundSecondary: "#4A5568",
    backgroundTertiary: "#718096",
    border: "#4A5568",
    surface: "#2D3748",
    success: "#48BB78",
    warning: "#ED8936",
    error: "#FC8181",
    info: "#63B3ED",
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
