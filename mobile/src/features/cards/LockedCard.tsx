import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { frameRects, type WindowRect } from './frameLayout';
import { gradient } from './gradient';
import type { CardView } from './types';

// Neutral, desaturated card surface: a card is its own surface, so these are fixed values.
const FRAME_FILL = '#8D8A87';
const FRAME_EDGE = '#6F6C69';
const NAME_FILL = '#B4B1AE';
const ART_FILL = '#CFCCC9';
const LOCK = '#7A7774';
const STATS_FILL = '#E9E7E4';
const INK = '#2F2D2B';
const INK_MUTED = '#5A5755';
const MAX_TEXT_SCALE = 1.15;

type LockedCardProps = {
  restaurant: CardView['restaurant'];
  width: number;
  style?: StyleProp<ViewStyle>;
};

function windowStyle(box: WindowRect): ViewStyle {
  return { position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r, overflow: 'hidden' };
}

export function LockedCard({ restaurant, width, style }: LockedCardProps) {
  const rects = useMemo(() => frameRects(width), [width]);
  const px = (value: number) => value * rects.scale;
  const neighbourhood = restaurant.locationLabel.split(' · ')[0];
  const lockWidth = Math.min(rects.art.w, rects.art.h) * 0.4;
  const bodyHeight = lockWidth * 0.78;
  const shackleWidth = lockWidth * 0.64;
  const shackleThickness = lockWidth * 0.14;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${restaurant.name}, locked. Scan a receipt from this restaurant to unlock its card.`}
      style={[
        { width, height: rects.height, borderRadius: rects.radius, borderWidth: Math.max(1, px(10)), borderColor: FRAME_EDGE, overflow: 'hidden' },
        gradient(`linear-gradient(160deg, #A19E9B, ${FRAME_FILL})`, FRAME_FILL),
        style,
      ]}
    >
      <View style={[windowStyle(rects.name), styles.centered, { backgroundColor: NAME_FILL, paddingHorizontal: px(28) }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{ color: INK, fontWeight: '700', fontSize: Math.max(13, px(56)) }}
        >
          {restaurant.name}
        </Text>
      </View>

      <View style={[windowStyle(rects.art), styles.centered, { backgroundColor: ART_FILL }]}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: shackleWidth, height: lockWidth * 0.5, borderTopLeftRadius: shackleWidth / 2, borderTopRightRadius: shackleWidth / 2, borderWidth: shackleThickness, borderBottomWidth: 0, borderColor: LOCK, marginBottom: -1 }} />
          <View style={[styles.centered, { width: lockWidth, height: bodyHeight, borderRadius: lockWidth * 0.12, backgroundColor: LOCK }]}>
            <View style={{ width: lockWidth * 0.12, height: bodyHeight * 0.3, borderRadius: lockWidth * 0.06, backgroundColor: ART_FILL }} />
          </View>
        </View>
      </View>

      <View style={[windowStyle(rects.stats), { backgroundColor: STATS_FILL, paddingHorizontal: px(28), justifyContent: 'center', gap: px(8) }]}>
        <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: INK, fontWeight: '700', fontSize: Math.max(11, px(40)) }}>
          {neighbourhood}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: INK_MUTED, fontSize: Math.max(10, px(32)) }}>
          Scan a receipt to unlock
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
});
