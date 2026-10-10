import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
};

export function MessagePanel({ title, body, kind = 'plain', loading = false, actionLabel, onAction }: MessagePanelProps) {
  return (
    <View style={[styles.panel, kind === 'error' ? styles.errorPanel : undefined]}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      <AppText variant="heading" strong>{title}</AppText>
      <AppText muted style={styles.body}>{body}</AppText>
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.xl, borderRadius: radius.card, gap: spacing.md, backgroundColor: colors.surfaceMuted, alignItems: 'flex-start' },
  errorPanel: { backgroundColor: colors.errorSoft },
  body: { flexShrink: 1 },
});
