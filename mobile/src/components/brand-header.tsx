import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { colors, spacing } from '@/theme/tokens';

export function BrandHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <AppText variant="caption" strong style={styles.eyebrow}>{eyebrow.toUpperCase()}</AppText> : null}
      <AppText variant="title" strong>{title}</AppText>
      {subtitle ? <AppText muted>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.xs }, eyebrow: { letterSpacing: 1.2, color: colors.accent } });
