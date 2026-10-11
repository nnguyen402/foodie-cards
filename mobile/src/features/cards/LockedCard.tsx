import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { frameRects } from './frameLayout';
import { CardBack } from './reveal/CardBack';
import type { CardView } from './types';

// An undiscovered restaurant is a face-down card: the reveal's card back with a
// name band across the bottom. A card is its own surface, so these are fixed values.
const GOLD = '#f2b632';
const INK = '#f6ede2';
const INK_MUTED = '#b5a594';
const BAND = 'rgba(18,13,8,0.9)';
// Below this width the card is a collection thumbnail and drops the unlock hint.
const COMPACT_BELOW = 240;
const MAX_TEXT_SCALE = 1.15;

type LockedCardProps = {
  restaurant: CardView['restaurant'];
  width: number;
  style?: StyleProp<ViewStyle>;
};

export function LockedCard({ restaurant, width, style }: LockedCardProps) {
  const rects = useMemo(() => frameRects(width), [width]);
  const px = (value: number) => value * rects.scale;
  const neighbourhood = restaurant.locationLabel.split(' · ')[0];
  const compact = width < COMPACT_BELOW;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${restaurant.name}, ${neighbourhood}, not discovered yet. Scan a receipt from this restaurant to unlock its card.`}
      style={[{ width, height: rects.height, borderRadius: rects.radius, overflow: 'hidden' }, style]}
    >
      <CardBack width={width} />
      <View style={[styles.band, { paddingHorizontal: px(44), paddingTop: px(22), paddingBottom: px(34), gap: px(4) }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{ color: INK, fontWeight: '800', fontSize: Math.max(13, px(50)), textAlign: 'center' }}
        >
          {restaurant.name}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: GOLD, fontWeight: '700', fontSize: Math.max(10, px(30)), letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
          {neighbourhood}
        </Text>
        {compact ? null : (
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={{ color: INK_MUTED, fontSize: px(28), textAlign: 'center' }}>
            Scan a receipt to unlock
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BAND, borderTopWidth: 1, borderTopColor: GOLD },
});
