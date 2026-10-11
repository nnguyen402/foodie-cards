import { Color } from 'expo-router';
import { Platform } from 'react-native';

export const reusablesPalette = {
  light: {
    background: '#FBF7F1', foreground: '#30251E', card: '#FFFFFF', cardForeground: '#30251E',
    popover: '#FFFFFF', popoverForeground: '#30251E', primary: '#B84F38', primaryForeground: '#FFFFFF',
    secondary: '#F3EAE0', secondaryForeground: '#30251E', muted: '#F3EAE0', mutedForeground: '#78695F',
    accent: '#F6E0D8', accentForeground: '#30251E', destructive: '#A2332D', destructiveForeground: '#FFFFFF',
    border: '#E3D8CD', input: '#E3D8CD', ring: '#7F3A2A',
  },
  dark: {
    background: '#1E1916', foreground: '#F8F1E8', card: '#29221E', cardForeground: '#F8F1E8',
    popover: '#29221E', popoverForeground: '#F8F1E8', primary: '#E08A70', primaryForeground: '#241914',
    secondary: '#392F29', secondaryForeground: '#F8F1E8', muted: '#392F29', mutedForeground: '#C4B5A9',
    accent: '#4A3028', accentForeground: '#F8F1E8', destructive: '#DF766D', destructiveForeground: '#241414',
    border: '#51443B', input: '#51443B', ring: '#E08A70',
  },
} as const;
const select = (ios: unknown, android: unknown, web: string) => Platform.select({ ios, android, default: web }) as string;

export const colors = {
  canvas: select(Color.ios.systemGroupedBackground, Color.android.dynamic.surface, reusablesPalette.light.background),
  surface: select(Color.ios.secondarySystemGroupedBackground, Color.android.dynamic.surfaceContainerLowest, reusablesPalette.light.card),
  surfaceMuted: select(Color.ios.tertiarySystemGroupedBackground, Color.android.dynamic.surfaceVariant, reusablesPalette.light.secondary),
  ink: select(Color.ios.label, Color.android.dynamic.onSurface, reusablesPalette.light.foreground),
  inkMuted: select(Color.ios.secondaryLabel, Color.android.dynamic.onSurfaceVariant, reusablesPalette.light.mutedForeground),
  accent: reusablesPalette.light.primary,
  accentPressed: '#9D3F2C',
  accentSoft: reusablesPalette.light.accent,
  border: select(Color.ios.separator, Color.android.dynamic.outlineVariant, reusablesPalette.light.border),
  success: select(Color.ios.systemGreen, Color.android.dynamic.primary, '#2F6D51'),
  error: select(Color.ios.systemRed, Color.android.dynamic.error, reusablesPalette.light.destructive),
  errorSoft: select(Color.ios.tertiarySystemGroupedBackground, Color.android.dynamic.errorContainer, '#F8E7E4'),
  focus: reusablesPalette.light.ring,
  white: reusablesPalette.light.primaryForeground,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, page: 24 } as const;
export const radius = { control: 14, card: 22, pill: 999 } as const;
export const radiusCss = `${radius.control / 16}rem`;
export const type = {
  display: 34,
  title: 27,
  heading: 20,
  body: 16,
  small: 14,
  caption: 12,
} as const;
