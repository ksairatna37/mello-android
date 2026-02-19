/**
 * ThemedAuroraGradient Component
 * Easy-to-switch aurora themes for testing
 *
 * Usage: <ThemedAuroraGradient theme="warmPink" />
 *
 * Available themes:
 * - warmPink (default) - Pink/peach tones
 * - deepPurple - Purple/violet
 * - coolTeal - Teal/cyan
 * - softLavender - Lavender/lilac
 * - deepIndigo - Indigo/blue
 * - darkEmerald - Emerald/green
 * - softCream - Light cream/beige (for light mode)
 * - roseDawn - Soft rose/coral
 * - oceanMist - Soft blue/gray
 */

import React, { memo } from 'react';
import AuroraGradient from './AuroraGradient';

// Theme configurations with gradient + blob colors
const AURORA_THEMES = {
  // Original dark themes (from get-rolling)
  warmPink: {
    gradient: ['#D0C0C8', '#B8A8B0', '#907080', '#604050', '#3D2030', '#E8A0B0'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#1A0D18', '#2D1525', '#4A2838', '#6A4555',
      '#D4907A', '#F0A8B8', '#E8A0B0', '#E8B098',
      '#D8B8C8', '#E0909A', '#C08070', '#251520',
    ],
  },

  deepPurple: {
    gradient: ['#C8C0E0', '#9080B8', '#6050A0', '#3A2870', '#1A1535', '#B090D0'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#1A1030', '#2D2050', '#4A3878', '#6A5095',
      '#B090D0', '#C8A8E8', '#D0B0F0', '#E0C8F8',
      '#C8B8E0', '#B0A0D0', '#9080B8', '#201830',
    ],
  },

  coolTeal: {
    gradient: ['#C0D8D8', '#88B0B0', '#507878', '#304848', '#182828', '#90C8C8'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#102828', '#1A3838', '#2A5050', '#3A6868',
      '#80B8B8', '#98D0D0', '#B0E0E0', '#C8F0F0',
      '#A8D0D0', '#90C0C0', '#78A8A8', '#183030',
    ],
  },

  softLavender: {
    gradient: ['#E0D0E8', '#C0A8D0', '#8868A0', '#503868', '#281838', '#D0B8E0'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#181028', '#281840', '#402858', '#584070',
      '#B898D0', '#D0B0E8', '#E0C8F0', '#F0E0F8',
      '#D8C0E8', '#C8B0D8', '#A890C0', '#201830',
    ],
  },

  deepIndigo: {
    gradient: ['#C0C8E0', '#8090C0', '#5060A0', '#303870', '#181838', '#A0B0D8'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#101830', '#182848', '#284060', '#385878',
      '#8098C0', '#98B0D8', '#B0C8E8', '#C8E0F8',
      '#B0C0E0', '#98A8D0', '#7890B8', '#182038',
    ],
  },

  darkEmerald: {
    gradient: ['#B0D0C8', '#80A898', '#507868', '#304840', '#182820', '#90C8B0'] as const,
    locations: [0, 0.18, 0.36, 0.54, 0.78, 1] as const,
    blobs: [
      '#102018', '#1A3028', '#2A4838', '#3A6050',
      '#80B8A0', '#98D0B8', '#B0E8D0', '#C8F8E8',
      '#A8D8C0', '#90C8B0', '#78A898', '#183828',
    ],
  },

  // NEW: Light/soft themes for light mode
  softCream: {
    gradient: ['#FBF9F7', '#F8F5F0', '#F5F0E8', '#F0E8E0', '#EBE0D8', '#F8F0E8'] as const,
    locations: [0, 0.2, 0.4, 0.6, 0.8, 1] as const,
    blobs: [
      '#F5E8E0', '#F0E0D8', '#E8D8D0', '#E0D0C8',
      '#F8E8D8', '#FFF0E0', '#FFF5E8', '#FFF8F0',
      '#F5E0D0', '#F0D8C8', '#E8D0C0', '#F8F0E8',
    ],
  },

  roseDawn: {
    gradient: ['#FFF8F5', '#FFF0F0', '#FFE8E8', '#F8E0E0', '#F0D8D8', '#FFE8E0'] as const,
    locations: [0, 0.2, 0.4, 0.6, 0.8, 1] as const,
    blobs: [
      '#FFE0E0', '#FFD8D8', '#F8D0D0', '#F0C8C8',
      '#FFE8E0', '#FFF0E8', '#FFF5F0', '#FFF8F5',
      '#FFE0D8', '#F8D8D0', '#F0D0C8', '#FFE8E8',
    ],
  },

  oceanMist: {
    gradient: ['#F8FCFF', '#F0F8FF', '#E8F4FF', '#E0F0FF', '#D8ECFF', '#E8F0FF'] as const,
    locations: [0, 0.2, 0.4, 0.6, 0.8, 1] as const,
    blobs: [
      '#E8F4FF', '#E0F0FF', '#D8ECFF', '#D0E8FF',
      '#E8F0FF', '#F0F8FF', '#F5FAFF', '#F8FCFF',
      '#E0ECFF', '#D8E8FF', '#D0E4FF', '#E8F4FF',
    ],
  },

  lavenderMist: {
    gradient: ['#EDE6FF', '#E4DAFF', '#DCD0FF', '#D4C8FF', '#CCC0FF', '#DCD4FF'] as const,
    locations: [0, 0.2, 0.4, 0.6, 0.8, 1] as const,
    blobs: [
      '#D8CCFF', '#D0C4FF', '#C8BAFF', '#C0B2FF',
      '#DCD4FF', '#E4DAFF', '#EAE2FF', '#EDE6FF',
      '#D4CAFF', '#CCC2FF', '#C4BAFF', '#D8CCFF',
    ],
  },
};

export type AuroraThemeName = keyof typeof AURORA_THEMES;

interface ThemedAuroraGradientProps {
  theme?: AuroraThemeName;
}

const ThemedAuroraGradient = memo(({ theme = 'warmPink' }: ThemedAuroraGradientProps) => {
  const config = AURORA_THEMES[theme] || AURORA_THEMES.warmPink;

  return (
    <AuroraGradient
      gradientColors={config.gradient}
      gradientLocations={config.locations}
      blobColors={config.blobs}
    />
  );
});

ThemedAuroraGradient.displayName = 'ThemedAuroraGradient';

export default ThemedAuroraGradient;

// Export theme names for easy reference
export const AVAILABLE_THEMES: AuroraThemeName[] = [
  'warmPink',
  'deepPurple',
  'coolTeal',
  'softLavender',
  'deepIndigo',
  'darkEmerald',
  'softCream',
  'roseDawn',
  'oceanMist',
  'lavenderMist',
];
