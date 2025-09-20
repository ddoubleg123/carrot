/**
 * Design Token Utilities
 * Provides type-safe access to CSS custom properties (design tokens)
 */

// Color tokens
export const colors = {
  // Primary colors
  primary: {
    50: 'var(--color-primary-50)',
    100: 'var(--color-primary-100)',
    200: 'var(--color-primary-200)',
    300: 'var(--color-primary-300)',
    400: 'var(--color-primary-400)',
    500: 'var(--color-primary-500)',
    600: 'var(--color-primary-600)', // Civic Blue
    700: 'var(--color-primary-700)',
    800: 'var(--color-primary-800)',
    900: 'var(--color-primary-900)',
    950: 'var(--color-primary-950)',
  },
  
  // Semantic colors
  success: {
    50: 'var(--color-success-50)',
    500: 'var(--color-success-500)',
    600: 'var(--color-success-600)',
    700: 'var(--color-success-700)',
  },
  
  warning: {
    50: 'var(--color-warning-50)',
    500: 'var(--color-warning-500)',
    600: 'var(--color-warning-600)',
  },
  
  error: {
    50: 'var(--color-error-50)',
    500: 'var(--color-error-500)',
    600: 'var(--color-error-600)',
  },
  
  // Neutral colors
  gray: {
    50: 'var(--color-gray-50)',
    100: 'var(--color-gray-100)',
    200: 'var(--color-gray-200)',
    300: 'var(--color-gray-300)',
    400: 'var(--color-gray-400)',
    500: 'var(--color-gray-500)',
    600: 'var(--color-gray-600)',
    700: 'var(--color-gray-700)',
    800: 'var(--color-gray-800)',
    900: 'var(--color-gray-900)',
    950: 'var(--color-gray-950)',
  },
  
  // Special colors
  white: 'var(--color-white)',
  black: 'var(--color-black)',
  transparent: 'var(--color-transparent)',
} as const;

// Typography tokens
export const typography = {
  fontFamily: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
  
  fontSize: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
    '3xl': 'var(--text-3xl)',
    '4xl': 'var(--text-4xl)',
    '5xl': 'var(--text-5xl)',
  },
  
  fontWeight: {
    light: 'var(--font-light)',
    normal: 'var(--font-normal)',
    medium: 'var(--font-medium)',
    semibold: 'var(--font-semibold)',
    bold: 'var(--font-bold)',
  },
  
  lineHeight: {
    tight: 'var(--leading-tight)',
    snug: 'var(--leading-snug)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
    loose: 'var(--leading-loose)',
  },
} as const;

// Spacing tokens
export const spacing = {
  0: 'var(--space-0)',
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
  20: 'var(--space-20)',
  24: 'var(--space-24)',
  32: 'var(--space-32)',
  
  // Semantic spacing
  gap: {
    xs: 'var(--gap-xs)',
    sm: 'var(--gap-sm)',
    md: 'var(--gap-md)',
    lg: 'var(--gap-lg)',
    xl: 'var(--gap-xl)',
    '2xl': 'var(--gap-2xl)',
  },
  
  padding: {
    xs: 'var(--padding-xs)',
    sm: 'var(--padding-sm)',
    md: 'var(--padding-md)',
    lg: 'var(--padding-lg)',
    xl: 'var(--padding-xl)',
  },
} as const;

// Border radius tokens
export const borderRadius = {
  none: 'var(--radius-none)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

// Shadow tokens
export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  '2xl': 'var(--shadow-2xl)',
  inner: 'var(--shadow-inner)',
  
  // Special shadows
  glowBlue: 'var(--shadow-glow-blue)',
  glowBlueLg: 'var(--shadow-glow-blue-lg)',
} as const;

// Component tokens
export const components = {
  button: {
    height: {
      sm: 'var(--button-height-sm)',
      md: 'var(--button-height-md)',
      lg: 'var(--button-height-lg)',
    },
    paddingX: {
      sm: 'var(--button-padding-x-sm)',
      md: 'var(--button-padding-x-md)',
      lg: 'var(--button-padding-x-lg)',
    },
    radius: 'var(--button-radius)',
    fontWeight: 'var(--button-font-weight)',
  },
  
  input: {
    height: 'var(--input-height)',
    paddingX: 'var(--input-padding-x)',
    paddingY: 'var(--input-padding-y)',
    radius: 'var(--input-radius)',
    borderWidth: 'var(--input-border-width)',
    borderColor: 'var(--input-border-color)',
    borderColorFocus: 'var(--input-border-color-focus)',
  },
  
  card: {
    padding: 'var(--card-padding)',
    radius: 'var(--card-radius)',
    shadow: 'var(--card-shadow)',
    borderWidth: 'var(--card-border-width)',
    borderColor: 'var(--card-border-color)',
  },
  
  modal: {
    backdrop: 'var(--modal-backdrop)',
    radius: 'var(--modal-radius)',
    shadow: 'var(--modal-shadow)',
    padding: 'var(--modal-padding)',
  },
  
  avatar: {
    size: {
      sm: 'var(--avatar-size-sm)',
      md: 'var(--avatar-size-md)',
      lg: 'var(--avatar-size-lg)',
      xl: 'var(--avatar-size-xl)',
    },
    radius: 'var(--avatar-radius)',
  },
  
  badge: {
    paddingX: 'var(--badge-padding-x)',
    paddingY: 'var(--badge-padding-y)',
    radius: 'var(--badge-radius)',
    fontSize: 'var(--badge-font-size)',
    fontWeight: 'var(--badge-font-weight)',
  },
} as const;

// Layout tokens
export const layout = {
  container: {
    sm: 'var(--container-sm)',
    md: 'var(--container-md)',
    lg: 'var(--container-lg)',
    xl: 'var(--container-xl)',
    '2xl': 'var(--container-2xl)',
  },
  
  sidebar: {
    width: 'var(--sidebar-width)',
    widthCollapsed: 'var(--sidebar-width-collapsed)',
  },
  
  header: {
    height: 'var(--header-height)',
  },
  
  chatbar: {
    height: 'var(--chatbar-height)',
  },
} as const;

// Z-index tokens
export const zIndex = {
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  fixed: 'var(--z-fixed)',
  modalBackdrop: 'var(--z-modal-backdrop)',
  modal: 'var(--z-modal)',
  popover: 'var(--z-popover)',
  tooltip: 'var(--z-tooltip)',
} as const;

// Animation tokens
export const animation = {
  duration: {
    75: 'var(--duration-75)',
    100: 'var(--duration-100)',
    150: 'var(--duration-150)',
    200: 'var(--duration-200)',
    300: 'var(--duration-300)',
    500: 'var(--duration-500)',
    700: 'var(--duration-700)',
    1000: 'var(--duration-1000)',
  },
  
  easing: {
    linear: 'var(--ease-linear)',
    in: 'var(--ease-in)',
    out: 'var(--ease-out)',
    inOut: 'var(--ease-in-out)',
  },
} as const;

// Utility function to get CSS custom property value
export function getCSSVar(property: string): string {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  }
  return '';
}

// Utility function to set CSS custom property value
export function setCSSVar(property: string, value: string): void {
  if (typeof window !== 'undefined') {
    document.documentElement.style.setProperty(property, value);
  }
}

// Export all tokens as a single object
export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  components,
  layout,
  zIndex,
  animation,
} as const;

export default tokens;
