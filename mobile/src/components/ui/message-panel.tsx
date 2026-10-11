import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from './app-text';
import { Button } from './button';
import { colors, radius, spacing } from '@/theme/tokens';

type MessagePanelProps = {
  title: string;
  body: string;
  kind?: 'plain' | 'error';
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional overrides for screens with their own look. Defaults leave the shared style unchanged. */
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  bodyStyle?: StyleProp<TextStyle>;
  /** Drawn to the left of the title and body. */
  icon?: ReactNode;
};

export function MessagePanel({ title, body, kind = 'plain', loading = false, actionLabel, onAction, style, titleStyle, bodyStyle, icon }: MessagePanelProps) {
  return (
    <View style={[styles.panel, kind === 'error' ? styles.errorPanel : undefined, style]}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {icon ? (
        <View style={styles.iconRow}>
          {icon}
          <View style={styles.iconText}>
            <AppText variant="heading" strong style={titleStyle}>{title}</AppText>
            <AppText muted style={[styles.body, bodyStyle]}>{body}</AppText>
          </View>
        </View>
      ) : (
        <>
          <AppText variant="heading" strong style={titleStyle}>{title}</AppText>
          <AppText muted style={[styles.body, bodyStyle]}>{body}</AppText>
        </>
      )}
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.xl, borderRadius: radius.card, gap: spacing.md, backgroundColor: colors.surfaceMuted, alignItems: 'flex-start' },
  errorPanel: { backgroundColor: colors.errorSoft },
  body: { flexShrink: 1 },
  iconRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, alignSelf: 'stretch' },
  iconText: { flex: 1, gap: spacing.xs },
});
