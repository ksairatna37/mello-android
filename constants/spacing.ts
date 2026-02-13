/**
 * Mello Spacing System
 * Generous spacing for mental-health friendly "breathing room"
 */

export const Spacing = {
  // Base spacing scale (in pixels)
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,

  // Screen padding
  screenHorizontal: 20,
  screenVertical: 24,

  // Component-specific
  buttonPadding: {
    horizontal: 24,
    vertical: 14,
  },
  cardPadding: 20,
  inputPadding: {
    horizontal: 16,
    vertical: 14,
  },
  listItemPadding: {
    horizontal: 16,
    vertical: 12,
  },
} as const;

// Border radius
export const BorderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Shadow definitions
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
