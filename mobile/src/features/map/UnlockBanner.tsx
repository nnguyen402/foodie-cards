import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';
import type { UnlockTarget } from './unlockTarget';

/** Top of the Scan screen when it was opened from a restaurant on the map. */
export function UnlockBanner({ target }: { target: UnlockTarget }) {
  const nearbyOnly = !target.restaurantId;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${target.visit ? 'Logging a visit to' : 'Unlocking'} ${target.name}`} style={styles.banner}>
      <AppText variant="small" strong style={styles.eyebrow}>{target.visit ? 'LOGGING A VISIT' : 'UNLOCKING'}</AppText>
      <AppText variant="heading" strong>{target.visit ? 'Visit: ' : 'Unlocking: '}{target.name}</AppText>
      {target.address ? <AppText variant="small" muted>{target.address}</AppText> : null}
      {nearbyOnly ? <AppText variant="small" muted>This is a nearby listing, not one of our restaurants yet, so a card can’t be created for it from a receipt.</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: spacing.lg, gap: spacing.xs, borderRadius: radius.card, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  eyebrow: { letterSpacing: 1.2, color: colors.accent },
});
