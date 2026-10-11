import { forwardRef, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { heroHeight, vintage, vintageSpace, vintageText, withAlpha } from '@/theme/vintage';
import { useVintageFonts } from '@/theme/use-vintage-fonts';

// A deep red screen with the illustration only in a top hero (about 38% of the screen),
// faded into the red, and a movie-poster title set straight onto it. Used by Scan and Review.

const HERO = require('../../../assets/design/scan-hero.jpg');
const TRANSPARENT_RED = withAlpha(vintage.deepRed, 0);
const SHADE = withAlpha(vintage.ink, 0.5);
const SHADE_MID = withAlpha(vintage.ink, 0.22);
const SHADE_CLEAR = withAlpha(vintage.ink, 0);
const VIGNETTE = withAlpha('#000000', 0.3);
const VIGNETTE_CLEAR = withAlpha('#000000', 0);
/** Room kept free at the top right for the settings gear. */
const GEAR_CLEARANCE = 64;

export function VintageHero({ height }: { height: number }) {
  return (
    <View pointerEvents="none" style={[styles.hero, { height }]}>
      <Image source={HERO} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      {/* Soft vignette on the left and right edges. */}
      <LinearGradient colors={[VIGNETTE, VIGNETTE_CLEAR, VIGNETTE_CLEAR, VIGNETTE]} locations={[0, 0.22, 0.78, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      {/* Soft, edgeless shade under the title for contrast: strongest top left, gone well before the art's far side. */}
      <LinearGradient colors={[SHADE, SHADE_MID, SHADE_CLEAR]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0.15 }} end={{ x: 0.85, y: 0.65 }} style={StyleSheet.absoluteFill} />
      {/* Fade into the red ground. */}
      <LinearGradient colors={[TRANSPARENT_RED, withAlpha(vintage.deepRed, 0.75), vintage.deepRed]} locations={[0.35, 0.75, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function VintageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  const { font } = useVintageFonts();
  return (
    <View style={styles.titleBlock}>
      <Text allowFontScaling style={[styles.eyebrow, font('semibold')]}>{eyebrow}</Text>
      <Text allowFontScaling maxFontSizeMultiplier={1.3} accessibilityRole="header" style={[styles.title, font('display')]}>{title}</Text>
      <View style={styles.divider} />
      {subtitle ? <Text allowFontScaling numberOfLines={2} style={[styles.subtitle, font('body')]}>{subtitle}</Text> : null}
    </View>
  );
}

type VintageScreenProps = Omit<ScrollViewProps, 'children' | 'contentContainerStyle'> & {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Space kept below the last item: pass `tabScrollBottomPadding(insets.bottom)` inside the tabs. */
  bottomPadding?: number;
  children?: ReactNode;
};

export const VintageScreen = forwardRef<ScrollView, VintageScreenProps>(function VintageScreen({ eyebrow, title, subtitle, bottomPadding, children, style, ...scrollProps }, ref) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const hero = heroHeight(height);
  return (
    <View style={styles.ground}>
      <ScrollView
        ref={ref}
        contentInsetAdjustmentBehavior="never"
        style={[styles.ground, style]}
        contentContainerStyle={{ paddingBottom: bottomPadding ?? insets.bottom + vintageSpace.xxl }}
        {...scrollProps}
      >
        <VintageHero height={hero} />
        <View style={[styles.header, { paddingTop: insets.top + vintageSpace.xl, minHeight: hero - vintageSpace.xxl }]}>
          <VintageTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: vintage.deepRed },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: vintage.deepRed },
  header: { paddingLeft: vintageSpace.xl, paddingRight: GEAR_CLEARANCE, paddingBottom: vintageSpace.xl, justifyContent: 'flex-start' },
  titleBlock: { gap: vintageSpace.md },
  eyebrow: { color: vintage.gold, fontSize: 12, lineHeight: 16, letterSpacing: 2.5 },
  title: {
    color: vintage.cream,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  divider: { width: 40, height: 2, borderRadius: 1, backgroundColor: vintage.gold },
  subtitle: { color: vintageText.secondary, fontSize: 15, lineHeight: 21, maxWidth: 340 },
  body: { paddingHorizontal: vintageSpace.xl, gap: vintageSpace.lg },
});
