import { Color } from 'expo-router';
import { Platform } from 'react-native';

const select = (ios: unknown, android: unknown, web: string) => Platform.select({ ios, android, default: web }) as string;

export const colors = {
  canvas: select(Color.ios.systemGroupedBackground, Color.android.dynamic.surface, '#FBF7F1'),
  surface: select(Color.ios.secondarySystemGroupedBackground, Color.android.dynamic.surfaceContainerLowest, '#FFFFFF'),
  surfaceMuted: select(Color.ios.tertiarySystemGroupedBackground, Color.android.dynamic.surfaceVariant, '#F3EAE0'),
  ink: select(Color.ios.label, Color.android.dynamic.onSurface, '#30251E'),
  inkMuted: select(Color.ios.secondaryLabel, Color.android.dynamic.onSurfaceVariant, '#78695F'),
  accent: '#B84F38',
  accentPressed: '#9D3F2C',
  accentSoft: '#F6E0D8',
  border: select(Color.ios.separator, Color.android.dynamic.outlineVariant, '#E3D8CD'),
  success: select(Color.ios.systemGreen, Color.android.dynamic.primary, '#2F6D51'),
  error: select(Color.ios.systemRed, Color.android.dynamic.error, '#A2332D'),
  errorSoft: select(Color.ios.tertiarySystemGroupedBackground, Color.android.dynamic.errorContainer, '#F8E7E4'),
  focus: '#7F3A2A',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, page: 24 } as const;
export const radius = { control: 14, card: 22, pill: 999 } as const;
export const type = {
  display: 34,
  title: 27,
  heading: 20,
  body: 16,
  small: 14,
  caption: 12,
} as const;
