// The "vintage movie poster" look used by the Scan and Review receipt screens: a deep red
// ground, an illustration hero at the top, cream and gold type. Pure values and helpers only
// (no React Native imports), so they can be unit-tested; the font hook lives in
// use-vintage-fonts.ts.

export const vintage = {
  deepRed: '#6B1414',
  crimson: '#8E1B1B',
  rust: '#B5482E',
  /** Rust lightened for small text on ink/deepRed, where the spec rust is only ~3.2:1. */
  rustText: '#D0664A',
  gold: '#D4A84B',
  cream: '#F3E6CF',
  ink: '#141212',
  sage: '#4E6B4A',
} as const;

export type VintageColor = keyof typeof vintage;

/** The only spacing steps these screens use. */
export const vintageSpace = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const vintageRadius = { control: 12, banner: 16, card: 16, /** Scan upload card. */ sheet: 24, /** Buttons on the Scan upload card. */ button: 16 } as const;

/** `#RRGGBB` plus an opacity from 0 to 1 → `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a #RRGGBB colour, got ${hex}`);
  const value = parseInt(match[1], 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${a})`;
}

/** Text colours on the dark ground, named so screens never reach for a light-on-light mix. */
export const vintageText = {
  primary: vintage.cream,
  secondary: withAlpha(vintage.cream, 0.85),
  muted: withAlpha(vintage.cream, 0.7),
  accent: vintage.gold,
} as const;

// Fonts come from @expo-google-fonts and load at runtime. Until they have loaded, each role
// falls back to the system font with a matching weight, so nothing ever waits on a download.
export const vintageFontFamilies = {
  display: 'Cinzel_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export type VintageFontRole = keyof typeof vintageFontFamilies;

const FALLBACK_WEIGHT: Record<VintageFontRole, '400' | '500' | '600' | '700'> = {
  display: '700', body: '400', medium: '500', semibold: '600',
};

export type VintageFontStyle = { fontFamily?: string; fontWeight?: '400' | '500' | '600' | '700' };

/**
 * The text style for a font role: the loaded family, or the system font at the same weight.
 * A loaded family already carries its weight, so the weight is reset to 400; otherwise a
 * caller's bold (e.g. AppText `strong`) would ask the platform to fake-bold the face.
 */
export function vintageFont(role: VintageFontRole, loaded: boolean, systemSerif?: string): VintageFontStyle {
  if (loaded) return { fontFamily: vintageFontFamilies[role], fontWeight: '400' };
  if (role === 'display' && systemSerif) return { fontFamily: systemSerif, fontWeight: FALLBACK_WEIGHT[role] };
  return { fontWeight: FALLBACK_WEIGHT[role] };
}

/** Height of the floating native tab bar (~72) above the bottom safe area. NativeTabs has no JS height API. */
export const FLOATING_TAB_BAR = 72;

/** How far content must stay above the bottom edge to clear the floating tab bar. */
export function tabBarClearance(bottomInset: number): number {
  return Math.max(0, bottomInset) + FLOATING_TAB_BAR;
}

/** Bottom padding for a scroll view inside the tabs: the tab bar plus one spacing step of air. */
export function tabScrollBottomPadding(bottomInset: number): number {
  return tabBarClearance(bottomInset) + vintageSpace.xl;
}

/** The illustration hero takes about 38% of the screen height. */
export const HERO_FRACTION = 0.38;

export function heroHeight(windowHeight: number): number {
  return Math.round(Math.max(0, windowHeight) * HERO_FRACTION);
}

/**
 * The size of a photo shown as a framed print: the largest box with the photo's aspect ratio
 * that fits inside the space given, so the mat hugs the photo with no empty side bars.
 * Falls back to a portrait receipt shape (3:4) while the real size is unknown.
 */
export function framedPrintSize(image: { width: number; height: number } | null, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const boxW = Math.max(0, maxWidth);
  const boxH = Math.max(0, maxHeight);
  const ratio = image && image.width > 0 && image.height > 0 ? image.width / image.height : 3 / 4;
  let width = boxW;
  let height = width / ratio;
  if (height > boxH) {
    height = boxH;
    width = height * ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}
