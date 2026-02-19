/**
 * TimeAwareGradient Component
 * Wraps AuroraGradient with time-of-day color palettes
 * Morning: warm peach/gold | Afternoon: soft mint/teal
 * Evening: lavender/purple | Night: deep indigo/navy
 */

import React, { useMemo } from 'react';
import AuroraGradient from '@/components/common/AuroraGradient';

type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeAwareGradientProps {
  /** Override the auto-detected time period */
  forcePeriod?: TimePeriod;
}

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ═══════════════════════════════════════════════════════════════════
// TIME PALETTES - Each crafted to evoke the emotional tone of the hour
// ═══════════════════════════════════════════════════════════════════

const PALETTES: Record<TimePeriod, {
  gradientColors: readonly [string, string, ...string[]];
  gradientLocations: readonly [number, number, ...number[]];
  blobColors: string[];
}> = {
  // Warm Peach/Gold - Hope & Fresh Start
  morning: {
    gradientColors: ['#FFF0E0', '#F0D0B0', '#C89868', '#785030', '#281810', '#E8B878'],
    gradientLocations: [0, 0.15, 0.38, 0.58, 0.82, 1],
    blobColors: [
      '#180C08', '#281810', '#483828', '#A07848',
      '#E8C088', '#F8E0C0', '#D8B890', '#FFF4E0',
      '#FFFBF0', '#C89048', '#584830', '#1C1008',
    ],
  },

  // Soft Mint/Teal - Energy & Calm Focus
  afternoon: {
    gradientColors: ['#E0F8F0', '#B0E8D0', '#58C098', '#286850', '#082818', '#88D8B0'],
    gradientLocations: [0, 0.15, 0.38, 0.58, 0.82, 1],
    blobColors: [
      '#041810', '#0C2018', '#284038', '#48A078',
      '#88E0B8', '#C0F0D8', '#A8D8C0', '#F0FFF8',
      '#F8FFFC', '#58B888', '#405848', '#102818',
    ],
  },

  // Lavender/Purple - Wind Down & Reflection
  evening: {
    gradientColors: ['#F0E8F8', '#D0B8E8', '#9870B8', '#584078', '#201030', '#B890D0'],
    gradientLocations: [0, 0.15, 0.38, 0.58, 0.82, 1],
    blobColors: [
      '#140820', '#1C1030', '#382850', '#7858A0',
      '#B898D8', '#D8C8F0', '#C8B0E0', '#F4F0FF',
      '#FBF8FF', '#8868B0', '#504068', '#1C1028',
    ],
  },

  // Deep Indigo/Navy - Rest & Tranquility
  night: {
    gradientColors: ['#E0E0F8', '#B0B0E0', '#6060A8', '#303068', '#0C0C28', '#8080C0'],
    gradientLocations: [0, 0.15, 0.38, 0.58, 0.82, 1],
    blobColors: [
      '#04041C', '#0C0C28', '#202048', '#404088',
      '#7878C0', '#B0B0E0', '#9898C8', '#E8E8FF',
      '#F4F4FF', '#5858A0', '#383858', '#0C0C20',
    ],
  },
};

export default function TimeAwareGradient({ forcePeriod }: TimeAwareGradientProps) {
  const palette = useMemo(() => {
    const period = forcePeriod || getTimePeriod();
    return PALETTES[period];
  }, [forcePeriod]);

  return (
    <AuroraGradient
      gradientColors={palette.gradientColors}
      gradientLocations={palette.gradientLocations}
      blobColors={palette.blobColors}
    />
  );
}

/** Get the current time period (useful for greeting text) */
export function useTimePeriod(forcePeriod?: TimePeriod): TimePeriod {
  return useMemo(() => forcePeriod || getTimePeriod(), [forcePeriod]);
}
