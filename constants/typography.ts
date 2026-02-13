/**
 * Mello Typography
 * Using Outfit font family throughout the app
 */

// Font weight to font family mapping
export const fontWeightMap: Record<
  '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold',
  string
> = {
  '100': 'Outfit-Thin',
  '200': 'Outfit-ExtraLight',
  '300': 'Outfit-Light',
  '400': 'Outfit-Regular',
  '500': 'Outfit-Medium',
  '600': 'Outfit-SemiBold',
  '700': 'Outfit-Bold',
  '800': 'Outfit-ExtraBold',
  '900': 'Outfit-Black',
  normal: 'Outfit-Regular',
  bold: 'Outfit-Bold',
};

/**
 * Get the correct font family for a given font weight
 */
export function getFontFamily(
  weight?: '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold'
): string {
  if (!weight) return 'Outfit-Regular';
  return fontWeightMap[weight] || 'Outfit-Regular';
}

export const Typography = {
  // Font families
  fontFamily: {
    thin: 'Outfit-Thin',
    extraLight: 'Outfit-ExtraLight',
    light: 'Outfit-Light',
    regular: 'Outfit-Regular',
    medium: 'Outfit-Medium',
    semiBold: 'Outfit-SemiBold',
    bold: 'Outfit-Bold',
    extraBold: 'Outfit-ExtraBold',
    black: 'Outfit-Black',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights (mapped to font families)
  fontWeight: {
    thin: '100' as const,
    extraLight: '200' as const,
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
    black: '900' as const,
  },
} as const;

// Pre-defined text styles with Outfit font
export const TextStyles = {
  h1: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: 'Outfit-Bold',
    lineHeight: Typography.fontSize['3xl'] * Typography.lineHeight.tight,
  },
  h2: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: 'Outfit-SemiBold',
    lineHeight: Typography.fontSize['2xl'] * Typography.lineHeight.tight,
  },
  h3: {
    fontSize: Typography.fontSize.xl,
    fontFamily: 'Outfit-SemiBold',
    lineHeight: Typography.fontSize.xl * Typography.lineHeight.tight,
  },
  body: {
    fontSize: Typography.fontSize.base,
    fontFamily: 'Outfit-Regular',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  },
  bodySmall: {
    fontSize: Typography.fontSize.sm,
    fontFamily: 'Outfit-Regular',
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },
  caption: {
    fontSize: Typography.fontSize.xs,
    fontFamily: 'Outfit-Regular',
    lineHeight: Typography.fontSize.xs * Typography.lineHeight.normal,
  },
  button: {
    fontSize: Typography.fontSize.base,
    fontFamily: 'Outfit-Medium',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.tight,
  },
} as const;
