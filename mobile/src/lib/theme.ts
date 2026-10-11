import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';
import { reusablesPalette, radiusCss } from '@/theme/tokens';

export const THEME = {
  light: { ...reusablesPalette.light, radius: radiusCss },
  dark: { ...reusablesPalette.dark, radius: radiusCss },
} as const;

function hexToHslChannels(hex: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function getThemeCssVariables(colorScheme: 'light' | 'dark' | 'system' | null | undefined) {
  const theme = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return {
    '--background': hexToHslChannels(theme.background),
    '--foreground': hexToHslChannels(theme.foreground),
    '--card': hexToHslChannels(theme.card),
    '--card-foreground': hexToHslChannels(theme.cardForeground),
    '--popover': hexToHslChannels(theme.popover),
    '--popover-foreground': hexToHslChannels(theme.popoverForeground),
    '--primary': hexToHslChannels(theme.primary),
    '--primary-foreground': hexToHslChannels(theme.primaryForeground),
    '--secondary': hexToHslChannels(theme.secondary),
    '--secondary-foreground': hexToHslChannels(theme.secondaryForeground),
    '--muted': hexToHslChannels(theme.muted),
    '--muted-foreground': hexToHslChannels(theme.mutedForeground),
    '--accent': hexToHslChannels(theme.accent),
    '--accent-foreground': hexToHslChannels(theme.accentForeground),
    '--destructive': hexToHslChannels(theme.destructive),
    '--destructive-foreground': hexToHslChannels(theme.destructiveForeground),
    '--border': hexToHslChannels(theme.border),
    '--input': hexToHslChannels(theme.input),
    '--ring': hexToHslChannels(theme.ring),
    '--radius': theme.radius,
  };
}

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
