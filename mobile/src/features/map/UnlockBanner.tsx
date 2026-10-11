import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CuisineArt } from '@/features/cards/CuisineArtView';
import { vintage, vintageRadius, vintageSpace, vintageText } from '@/theme/vintage';
import { useVintageFonts } from '@/theme/use-vintage-fonts';
import { bannerCuisine } from './bannerCuisine';
import type { UnlockTarget } from './unlockTarget';

/** Top of the Scan screen when it was opened from a restaurant on the map. */
export function UnlockBanner({ target, onDismiss }: { target: UnlockTarget; /** Hides the banner; the screen keeps the target. */ onDismiss?: () => void }) {
  const { font } = useVintageFonts();
  const nearbyOnly = !target.restaurantId;
  return (
    <View style={styles.banner}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${target.visit ? 'Logging a visit to' : 'Unlocking'} ${target.name}`} style={styles.main}>
        <View style={styles.ring}>
          <CuisineArt cuisine={bannerCuisine(target.name)} variant="token" />
        </View>
        <View style={styles.text}>
          <Text allowFontScaling numberOfLines={1} style={[styles.eyebrow, font('semibold')]}>{target.visit ? 'LOGGING A VISIT' : 'UNLOCKING'}</Text>
          <Text allowFontScaling numberOfLines={1} style={[styles.name, font('semibold')]}>{target.name}</Text>
          {target.address ? <Text allowFontScaling numberOfLines={1} style={[styles.address, font('body')]}>{target.address}</Text> : null}
          {nearbyOnly ? <Text allowFontScaling numberOfLines={1} style={[styles.notice, font('medium')]}>Nearby listing: no card from this receipt.</Text> : null}
        </View>
      </View>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Hide restaurant banner" hitSlop={12} onPress={onDismiss} style={styles.close}>
          <Ionicons name="close" size={20} color={vintageText.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const TOKEN = 48;

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: vintageSpace.sm, paddingVertical: vintageSpace.md, paddingLeft: vintageSpace.md, paddingRight: vintageSpace.sm, borderRadius: vintageRadius.banner, borderWidth: 1, borderColor: vintage.gold, backgroundColor: vintage.ink },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: vintageSpace.md },
  ring: { width: TOKEN, height: TOKEN, borderRadius: TOKEN / 2, borderWidth: 2, borderColor: vintage.gold, padding: 2, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  eyebrow: { color: vintage.gold, fontSize: 11, lineHeight: 14, letterSpacing: 2 },
  name: { color: vintage.cream, fontSize: 16, lineHeight: 21 },
  address: { color: vintageText.muted, fontSize: 13, lineHeight: 18 },
  notice: { color: vintage.rustText, fontSize: 12, lineHeight: 16 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
});
