/**
 * Unified application design tokens.
 * Features:
 * - Pure white background (#FFFFFF)
 * - Brand Primary: #2C5EAD for buttons and interactive controls
 * - Danger Theme: #E45742 for delete, bug reports, errors, and alerts
 */

import '@/global.css';
import { Platform } from 'react-native';

export const AppColors = {
  // Pure White Canvas & Surfaces
  white: '#ffffff',
  background: '#ffffff',
  card: '#ffffff',
  surface: '#f8fafc',
  surfaceSubtle: '#f1f5f9',

  // Primary Action & Button Elements (#2C5EAD)
  brandPrimary: '#2C5EAD',
  brandPrimaryLight: '#3B75D4',
  brandPrimaryDark: '#1F437D',
  brandPrimaryHover: '#234B8B',
  brandPrimaryGlow: 'rgba(44, 94, 173, 0.28)',

  // Danger Theme Elements (#E45742)
  brandDanger: '#E45742',
  brandDangerLight: '#FF6B54',
  brandDangerDark: '#C73824',
  brandDangerBg: 'rgba(228, 87, 66, 0.10)',
  brandDangerBorder: 'rgba(228, 87, 66, 0.32)',
  brandDangerGlow: 'rgba(228, 87, 66, 0.35)',

  // Neutral Text and Borders
  textPrimary: '#000000',
  textSecondary: '#1f2937',
  textMuted: '#4b5563',
  border: 'rgba(44, 94, 173, 0.14)',
  borderLight: '#e2e8f0',
  borderDanger: 'rgba(228, 87, 66, 0.35)',
} as const;

export const SkyColors = {
  // White Background & Card Surfaces
  sky25: '#ffffff',
  sky50: '#ffffff', // Background white
  sky100: '#f8fafc',
  sky200: '#e2e8f0',
  sky300: '#cbd5e1',

  // Primary Blue Elements (#2C5EAD)
  sky400: '#2C5EAD', // Active icons, accents, borders
  sky500: '#2C5EAD', // Primary button & pill color
  sky600: '#1F437D', // Deep pressed state
  sky700: '#193666',
  skyCloud: '#e2e8f0',
  skyViolet: '#2C5EAD',

  // Clean White Cards & Surfaces
  skyNight: '#ffffff',
  skyNightDeep: '#f8fafc',
  skyCardDark: '#ffffff',
  skyCardDarkSecondary: '#f8fafc',
  skySurfaceDark: '#f1f5f9',
  skyBorderDark: 'rgba(44, 94, 173, 0.16)',
  skyBorderLight: 'rgba(44, 94, 173, 0.12)',
  skyGlow: 'rgba(44, 94, 173, 0.25)',

  // Danger Theme (#E45742)
  danger: '#E45742',
  dangerLight: '#FF6B54',
  dangerBg: 'rgba(228, 87, 66, 0.10)',
  dangerBorder: 'rgba(228, 87, 66, 0.32)',
  dangerGlow: 'rgba(228, 87, 66, 0.35)',
} as const;

export const SkyGradients = {
  // Primary button gradient with #2C5EAD
  primary: ['#2C5EAD', '#3B75D4'] as const,
  primaryLight: ['#3B75D4', '#2C5EAD'] as const,
  vibrant: ['#2C5EAD', '#1F437D'] as const,

  // Danger button gradient with #E45742
  danger: ['#E45742', '#FF6B54'] as const,
  dangerVibrant: ['#E45742', '#C73824'] as const,

  // Radial gradients retained for backward compatibility & accents
  radial1Colors: ['#2C5EAD', '#3B75D4'] as const,
  radial2Colors: ['#3B75D4', '#2C5EAD'] as const,
  cssRadial1: 'radial-gradient(circle at 13% 67%, #2C5EAD, #3B75D4)',
  cssRadial2: 'radial-gradient(circle at 72% 48%, #E45742, #FF6B54)',
  cssColorGrading: 'radial-gradient(circle at 13% 67%, rgba(44, 94, 173, 0.15), transparent), radial-gradient(circle at 72% 48%, rgba(228, 87, 66, 0.08), transparent)',

  // Clean cards & light surfaces
  skySoft: ['#ffffff', '#f8fafc'] as const,
  skyAiry: ['#ffffff', '#ffffff'] as const,
  cardLight: ['#ffffff', '#f8fafc'] as const,
  cardDark: ['#ffffff', '#f8fafc'] as const,
  headerDark: ['#ffffff', '#f8fafc'] as const,
  accentGreen: ['#10b981', '#059669'] as const,
  amber: ['#f59e0b', '#d97706'] as const,
} as const;

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#1f2937',
    background: '#ffffff',
    backgroundElement: '#f8fafc',
    backgroundSelected: '#f1f5f9',
    card: '#ffffff',
    border: 'rgba(44, 94, 173, 0.14)',
    primary: '#2C5EAD',
    primaryLight: '#3B75D4',
    danger: '#E45742',
  },
  dark: {
    text: '#000000',
    textSecondary: '#1f2937',
    background: '#ffffff',
    backgroundElement: '#f8fafc',
    backgroundSelected: '#f1f5f9',
    card: '#ffffff',
    border: 'rgba(44, 94, 173, 0.16)',
    primary: '#2C5EAD',
    primaryLight: '#3B75D4',
    danger: '#E45742',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
