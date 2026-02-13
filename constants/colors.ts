/**
 * Mello Color Palette
 * Mental-health safe colors - soft, calming, trustworthy
 */

export const Colors = {
  // Primary brand colors (new mint/green theme)
  mello: {
    mint: '#7FFFD4',
    green: '#98FB98',
    lime: '#ADFF2F',
    yellow: '#F0E68C',
    purple: '#b9a6ff',
    pink: '#e4c1f9',
    light: '#f8f7ff',
    medium: '#edeafa',
  },

  // Gradient colors for chat/voice screens
  gradient: {
    cyan: '#7EECD3',
    mint: '#8CF5B8',
    green: '#A8F59E',
    lime: '#C5F57A',
    yellow: '#E8F0A0',
  },

  // Light mode
  light: {
    background: '#f8f7ff',
    surface: '#ffffff',
    text: '#1a1625',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#e0dce8',
    primary: '#b9a6ff',
    primaryForeground: '#1a1625',
    secondary: '#e4c1f9',
    secondaryForeground: '#1a1625',
    accent: '#edeafa',
    error: '#e53e3e',
    success: '#38a169',
  },

  // Dark mode
  dark: {
    background: '#1a1625',
    surface: '#2d2640',
    text: '#f0eef5',
    textSecondary: '#b8b3c4',
    textMuted: '#7a758a',
    border: '#3d3655',
    primary: '#9985e0',
    primaryForeground: '#f0eef5',
    secondary: '#c9a4d9',
    secondaryForeground: '#f0eef5',
    accent: '#3d3655',
    error: '#fc8181',
    success: '#68d391',
  },
} as const;

// Gradient definitions for use with expo-linear-gradient
export const Gradients = {
  melloPrimary: ['#b9a6ff', '#e4c1f9'],
  melloSoft: ['#f8f7ff', '#edeafa'],
  melloDark: ['#2d2640', '#1a1625'],
  // New chat/voice gradient (matches the design)
  melloChat: ['#7EECD3', '#8CF5B8', '#A8F59E', '#C5F57A', '#E8F0A0'],
  melloOrb: ['#7EECD3', '#A8F59E', '#E8F0A0'],
} as const;

export type ColorScheme = 'light' | 'dark';
export type MelloColors = typeof Colors.light;
