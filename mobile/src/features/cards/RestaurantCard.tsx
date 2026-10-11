import { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { CardFrame } from './CardFrame';
import { CardPattern } from './CardPattern';
import { CuisineArt } from './CuisineArtView';
import { cuisineKeyFor, hasCuisineArt, type CuisineKey } from './cuisineArt';
import { nameFont } from './fonts';
import { frameRects, type WindowRect } from './frameLayout';
import { describeProgress } from './progress';
import { stageLabel } from './stageStyles';
import { cardInk, ratingLabel, ratingSpoken, readableTextOn } from './themes';
import type { CardView } from './types';

// Below this width the card is a collection thumbnail and shows only the essentials.
const COMPACT_BELOW = 240;
const STATS_SURFACE = '#FFFDF8';
const STATS_MUTED = '#6B5D54';
// The card has a fixed shape, so its text can grow only slightly before it would clip.
// The full details are always available through the accessibility label and card detail.
const MAX_TEXT_SCALE = 1.15;

type RestaurantCardProps = {
  card: CardView;
  width: number;
  /** Prepared logo, storefront or food photo. Without one the themed fallback is drawn. */
  heroSource?: ImageSourcePropType;
  /** Preview of a restaurant the user has not collected: no stage, XP or visits are shown. */
  uncollected?: boolean;
  /** Overrides the cuisine worked out from the name and category, so a screen that already decided one (the map) cannot disagree. */
  cuisine?: CuisineKey;
  style?: StyleProp<ViewStyle>;
};

function windowStyle(box: WindowRect, backgroundColor: string): ViewStyle {
  return { position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r, backgroundColor, overflow: 'hidden' };
}

export function RestaurantCard({ card, width, heroSource, uncollected = false, cuisine: cuisineOverride, style }: RestaurantCardProps) {
  const rects = useMemo(() => frameRects(width), [width]);
  const { restaurant } = card;
  const cuisine = cuisineOverride ?? cuisineKeyFor({ name: restaurant.name, cuisine: restaurant.category });
  const { theme } = restaurant;
  const compact = width < COMPACT_BELOW;
  const px = (value: number) => value * rects.scale;
  const onPrimary = readableTextOn(theme.primaryColor);
  const onAccent = readableTextOn(theme.accentColor);
  const label = stageLabel(card.stage);
  const progress = describeProgress(card);
  const rating = ratingLabel(card.rating);
  const visits = `${card.visitCount} ${card.visitCount === 1 ? 'visit' : 'visits'}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={uncollected ? `${restaurant.name}, not collected yet` : `${restaurant.name}, ${label} card, ${card.cardXP} XP, ${visits}, ${ratingSpoken(card.rating)}`}
      style={[{ width, height: rects.height }, style]}
    >
      <CardFrame stage={card.stage} rects={rects} />

      <View style={[windowStyle(rects.name, theme.primaryColor), styles.centered, { paddingHorizontal: px(28) }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={[{ color: onPrimary, fontSize: Math.max(13, px(56)) }, nameFont(theme.fontKey)]}
        >
          {restaurant.name}
        </Text>
      </View>

      <View style={windowStyle(rects.art, theme.primaryColor)}>
        {heroSource ? (
          <Image source={heroSource} resizeMode={restaurant.heroImageKind === 'logo' ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
        ) : (
          <>
            {hasCuisineArt(cuisine) ? null : <CardPattern patternKey={theme.patternKey} color={theme.accentColor} width={rects.art.w} height={rects.art.h} scale={rects.scale} />}
            <CuisineArt cuisine={cuisine} variant="card" locked={uncollected} tint={{ background: theme.accentColor, ink: onAccent }} />
          </>
        )}
      </View>

      <View style={[windowStyle(rects.stats, STATS_SURFACE), { paddingHorizontal: px(28), justifyContent: 'center', gap: px(compact ? 6 : 14) }]}>
        {uncollected ? (
          <>
            <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: cardInk.dark, fontWeight: '700', fontSize: Math.max(11, px(38)) }}>Not collected yet</Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: STATS_MUTED, fontSize: Math.max(10, px(28)) }}>Scan a receipt to unlock</Text>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={{ backgroundColor: theme.accentColor, borderRadius: px(40), paddingHorizontal: px(22), paddingVertical: px(6) }}>
                <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: onAccent, fontWeight: '700', fontSize: Math.max(10, px(32)) }}>{label}</Text>
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: cardInk.dark, fontWeight: '700', fontSize: Math.max(10, px(34)) }}>
                {compact ? `${card.cardXP} XP` : rating}
              </Text>
            </View>
            {compact ? null : (
              <>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: cardInk.dark, fontWeight: '600', fontSize: px(36) }}>
                  {progress.nextStageLabel ? progress.text : `${card.cardXP} XP · ${visits}`}
                </Text>
                <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: STATS_MUTED, fontSize: px(28) }}>
                  {progress.nextStageLabel ? `Both needed for ${progress.nextStageLabel}` : 'Highest stage reached'}
                </Text>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
