import type { PropsWithChildren } from 'react';
import { Text, type TextProps } from 'react-native';
import { colors, type as typeScale } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption';

type AppTextProps = PropsWithChildren<TextProps & { variant?: Variant; muted?: boolean; strong?: boolean }>;

const sizes = {
  display: typeScale.display,
  title: typeScale.title,
  heading: typeScale.heading,
  body: typeScale.body,
  small: typeScale.small,
  caption: typeScale.caption,
};

export function AppText({ variant = 'body', muted = false, strong = false, style, ...props }: AppTextProps) {
  return (
    <Text
      allowFontScaling
      style={[
        { color: muted ? colors.inkMuted : colors.ink, fontSize: sizes[variant], lineHeight: sizes[variant] * 1.35 },
        strong ? { fontWeight: '700' as const } : undefined,
        style,
      ]}
      {...props}
    />
  );
}
