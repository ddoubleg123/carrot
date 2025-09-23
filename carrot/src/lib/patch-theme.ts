// Patch theme system for background variants
export const patchThemes = {
  light: "bg-[linear-gradient(180deg,#FFFFFF,rgba(10,90,255,0.03))]",
  warm: "bg-[linear-gradient(180deg,#FFFFFF,rgba(255,106,0,0.04))]",
  stone: "bg-[linear-gradient(180deg,#FFFFFF,#F7F8FA)]",
} as const;

export type PatchTheme = keyof typeof patchThemes;

// Design tokens
export const tokens = {
  colors: {
    actionOrange: '#FF6A00',
    civicBlue: '#0A5AFF',
    ink: '#0B0B0F',
    slate: '#60646C',
    line: '#E6E8EC',
    surface: '#FFFFFF',
  },
  radii: {
    lg: '0.5rem', // 8px
    xl: '1rem',   // 16px
    '2xl': '1rem', // 16px
  },
  motion: {
    tap: '120ms',
    enter: '180ms',
    exit: '160ms',
  },
  spacing: {
    cardPadding: '16px', // 16-24px as specified
    sectionGap: '2rem',
  },
} as const;

// Get theme class for a patch
export function getPatchThemeClass(theme?: string | null): string {
  if (!theme || !(theme in patchThemes)) {
    return patchThemes.light; // default
  }
  return patchThemes[theme as PatchTheme];
}
