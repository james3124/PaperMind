// PaperMind design tokens — "Paper & Ink" design language.
// Warm paper neutrals, a single deep petrol accent, and a strict
// type / spacing / radius scale. Both palettes are defined here so
// every screen renders from one source of truth.

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSoft: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  accentSubtle: string;
  onAccent: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;
  star: string;
  scrim: string;
  shadow: string;
}

export const lightPalette: Palette = {
  bg: '#f7f6f2',
  surface: '#ffffff',
  surfaceAlt: '#efede7',
  border: '#e5e2d9',
  text: '#23211b',
  textSoft: '#5c584c',
  textMuted: '#8f8a7c',
  accent: '#16655a',
  accentStrong: '#0f5048',
  accentSubtle: '#e0eeea',
  onAccent: '#ffffff',
  success: '#2f7d46',
  successSubtle: '#e3f0e5',
  warning: '#a16207',
  warningSubtle: '#f9efd8',
  danger: '#b03a30',
  dangerSubtle: '#f7e5e2',
  star: '#c77e12',
  scrim: 'rgba(24, 20, 12, 0.42)',
  shadow: 'rgba(46, 38, 22, 0.08)',
};

export const darkPalette: Palette = {
  bg: '#141311',
  surface: '#1d1b18',
  surfaceAlt: '#262420',
  border: '#32302a',
  text: '#ece9e0',
  textSoft: '#b3ada0',
  textMuted: '#7e786a',
  accent: '#58b4a5',
  accentStrong: '#79c7ba',
  accentSubtle: '#203430',
  onAccent: '#0b1f1b',
  success: '#72c488',
  successSubtle: '#1e2f22',
  warning: '#dfae53',
  warningSubtle: '#332b1a',
  danger: '#e8897d',
  dangerSubtle: '#37211e',
  star: '#e2a54a',
  scrim: 'rgba(0, 0, 0, 0.55)',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

/** 4-pt grid spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

/** Type scale — tracking tightens as size grows. */
export const type = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  heading: {fontSize: 17, lineHeight: 22, fontWeight: '700' as const},
  body: {fontSize: 15, lineHeight: 22},
  bodySm: {fontSize: 13, lineHeight: 19},
  label: {fontSize: 13, fontWeight: '600' as const},
  caption: {fontSize: 12, lineHeight: 17},
  micro: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  },
};

export const elevation = {
  /** Resting list cards — barely-there lift. */
  card: (shadow: string) => ({
    shadowColor: shadow,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  }),
  /** Menus and popovers. */
  raised: (shadow: string) => ({
    shadowColor: shadow,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 6},
    elevation: 10,
  }),
  /** FAB-level elements. */
  floating: (shadow: string) => ({
    shadowColor: shadow,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 5},
    elevation: 7,
  }),
};
