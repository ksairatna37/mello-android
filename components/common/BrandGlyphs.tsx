/**
 * BrandGlyphs — line icons + full mobile design tokens.
 *
 * This is the canonical source of truth for the SelfMind app's visual
 * system. Every value below is a **verbatim port** of the Claude Design
 * mockups in:
 *
 *   /Users/warmachine37/Downloads/selfmind app design screens/mobile-styles.css
 *
 * If the CSS changes, update this file. Do not hardcode brand colors,
 * radii, or type metrics elsewhere — import from here.
 */
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; color?: string };

/* ──────────────────────────────── icons ─────────────────────────────── */

export const Glyphs = {
  Mic: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth={1.6} />
      <Path d="M5 11a7 7 0 0014 0M12 18v3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  Book: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5a2 2 0 012-2h12v17H6a2 2 0 01-2-2V5zM8 8h8M8 12h6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  Leaf: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20c0-10 6-16 16-16 0 10-6 16-16 16zM4 20l9-9" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Sparkle: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" fill={color} />
    </Svg>
  ),
  Arrow: ({ size = 14, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Back: ({ size = 20, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Check: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4 10-10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Heart: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  HeartFilled: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  ),
  Breath: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 9.5c2.4-2.2 5.2-2.2 7.6 0 1.5 1.4 3.5 1.4 5 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M6.5 14.5c2.1 1.7 4.6 1.7 6.7 0 1.3-1.1 3-1.1 4.3 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  ),
  Sound: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 14.5V9.5h3.2L12 6v12l-4.3-3.5H4.5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M15 9.2c1.3 1.6 1.3 4 0 5.6M17.6 7c2.5 2.9 2.5 7.1 0 10" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  Wave: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 14c3 0 3-3 6-3s3 3 6 3 3-3 6-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  Moon: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  Close: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  Info: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 100-18 9 9 0 000 18z" stroke={color} strokeWidth={1.6} />
      <Path d="M12 11v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 8.2v.01" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  ),
  Home: ({ size = 16, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11l8-7 8 7v8a2 2 0 01-2 2h-3v-6h-6v6H6a2 2 0 01-2-2v-8z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Bell: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 16V11a6 6 0 1112 0v5l1.5 2H4.5L6 16z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 20a2 2 0 004 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  Chat: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-5l-4 4v-4H6a2 2 0 01-2-2V6z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  Profile: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  // Open eye — almond outline with a pupil. Used by save-profile's
  // "show password" toggle (and anywhere else that needs a reveal icon).
  ThumbUp: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11v9H4.5A1.5 1.5 0 013 18.5V12.5A1.5 1.5 0 014.5 11H7z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M7 11l4-7a2 2 0 011.8-1c1.2 0 2 1 2 2v3.5h4.4a2.1 2.1 0 012 2.5l-1.4 7A2 2 0 0117.8 20H7V11z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  ThumbUpFilled: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11v9H4.5A1.5 1.5 0 013 18.5V12.5A1.5 1.5 0 014.5 11H7z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M7 11l4-7a2 2 0 011.8-1c1.2 0 2 1 2 2v3.5h4.4a2.1 2.1 0 012 2.5l-1.4 7A2 2 0 0117.8 20H7V11z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  ),
  ThumbDown: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 13V4h2.5A1.5 1.5 0 0121 5.5v6A1.5 1.5 0 0119.5 13H17z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M17 13l-4 7a2 2 0 01-1.8 1c-1.2 0-2-1-2-2v-3.5H4.8a2.1 2.1 0 01-2-2.5l1.4-7A2 2 0 016.2 4H17v9z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  ThumbDownFilled: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 13V4h2.5A1.5 1.5 0 0121 5.5v6A1.5 1.5 0 0119.5 13H17z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M17 13l-4 7a2 2 0 01-1.8 1c-1.2 0-2-1-2-2v-3.5H4.8a2.1 2.1 0 01-2-2.5l1.4-7A2 2 0 016.2 4H17v9z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  ),
  Pencil: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 4.5l5 5L8.5 20.5H3.5v-5L14.5 4.5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M13 6l5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
  Star: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  ),
  StarFilled: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  ),
  Trash: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.5 11v6M13.5 11v6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  ),
  History: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 4v3.3h3.3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7v5l3.2 1.9" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  More: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h.01M12 12h.01M19 12h.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  ),
  Plus: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  EyeOpen: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  // Closed eye — gentle curve with two short lashes. Pairs with EyeOpen
  // for password show/hide toggles.
  EyeShut: ({ size = 18, color = 'currentColor' }: P) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11c2 4 6 6 9 6s7-2 9-6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 16l-1 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M19 16l1 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 18l-.5 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15 18l.5 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  ),
};

/* ──────────────────────────────── tokens ────────────────────────────── */

/** Colors — verbatim from mobile-styles.css :root */
export const BRAND = {
  // Surfaces
  cream:        '#FBF5EE',
  cream2:       '#F3ECDF',
  paper:        '#FFFFFF',
  // Text
  ink:          '#1A1F36',
  ink2:         '#4A4F67',
  ink3:         '#7A7F92',
  // Hairlines
  line:         'rgba(26,31,54,0.08)',
  line2:        'rgba(26,31,54,0.14)',
  // Accents
  peach:        '#F4D3BC',
  coral:        '#F4A988',
  lavender:     '#D9D6F3',
  /* Pressed-state lavender — same hue family as `lavender`, ~3 shade
   * stops deeper. Used on tappable lavender pills (suggestion chips,
   * mid-confidence chips on the reading screen). Don't substitute
   * `lavenderDeep` — that one is a text color, not a surface. */
  lavenderPress: '#C8C4ED',
  /* Translucent lavender wash for skeleton placeholders / disabled
   * states sitting on a cream canvas. */
  lavenderSkel: 'rgba(217,214,243,0.55)',
  /* Mid-saturation lavender for the "heavy" mood dot creature.
   * Sits between `lavender` (background-soft) and `lavenderDeep`
   * (text-only). Body fill, paired with `lavenderDeep` stroke. */
  lavenderMid:  '#B7AEDB',
  /* Translucent coral wash for "today highlight" surfaces — sits
   * over `cream`/`paper` without competing with whatever sits on top
   * (e.g. a colored dot creature). Same coral as `coral` (#F4A988)
   * with 30% alpha. */
  coralWash:    'rgba(244,169,136,0.30)',
  /* Warm muted clay — body fill for the "prickly" mood (irritation /
   * anger-adjacent). Shifted browner / less saturated than first pass
   * so it reads "earthier / grumpier" rather than "coral's cousin"
   * when sitting near `coral` in the picker row. Paired with `ink`
   * stroke. */
  clay:         '#C97B69',
  lavenderDeep: '#4D408A',
  sage:         '#CFE0C8',
  butter:       '#F1E4B2',
  /* Frosted-glass surfaces (Sound Spaces sitting screen, control bar). */
  glass:        'rgba(255,255,255,0.55)',
  glassMuted:   'rgba(255,255,255,0.4)',
  glassBorder:  'rgba(255,255,255,0.5)',
  /* Thin ink hairline on tinted/painterly surfaces (horizon line). */
  hairlineInk18: 'rgba(26,31,54,0.18)',
};

/**
 * Shadows — ports of the CSS --shadow / --shadow-sm.
 * Use `...SHADOW.sm` or `...SHADOW.md` inside a StyleSheet object.
 */
export const SHADOW = {
  sm: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  // Tab bar (from .mb-tabbar box-shadow: 0 8px 24px rgba(26,31,54,0.06))
  tabbar: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 6,
  },
};

/** Radii — ports of common border-radius values in the design. */
export const RADIUS = {
  card: 22,       // .mb-card
  chip: 999,      // .mb-chip
  btn: 999,       // .mb-btn
  tabbar: 28,     // .mb-tabbar
};

/** Typography metrics — font family names and key size/tracking values. */
export const TYPE = {
  /**
   * Fraunces display cuts. Pick the right optical size for rendered size:
   *   XL (144pt) → 46px+
   *   display (72pt) → 20–44px
   *   text (9pt) → 11–16px
   */
  displayXL:       'Fraunces-XL',
  displayXLItalic: 'Fraunces-XL-Italic',
  display:         'Fraunces',
  displayItalic:   'Fraunces-Italic',
  displayMedium:   'Fraunces-Medium',
  displayMediumItalic: 'Fraunces-MediumItalic',
  text:            'Fraunces-Text',
  textItalic:      'Fraunces-Text-Italic',
  textMedium:      'Fraunces-Text-Medium',
  textMediumItalic:'Fraunces-Text-MediumItalic',

  // Body UI
  body:        'Inter-Regular',
  bodyMedium:  'Inter-Medium',
  bodySemi:    'Inter-SemiBold',
  bodyBold:    'Inter-Bold',

  // Mono kickers
  mono:        'JetBrainsMono',
  monoMedium:  'JetBrainsMono-Medium',

  /**
   * Standard kicker style — mono, 10–11px, tracked wide, uppercase, ink3.
   * Use in StyleSheet.create as `...TYPE.kickerStyle`.
   */
  kickerStyle: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 2.2,        // 0.08em of 11px = 0.88 in web; RN needs ~2.2 to feel right
    color: '#7A7F92',
    textTransform: 'uppercase' as const,
  },
};
