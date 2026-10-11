import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { RestaurantStage } from '@foodie-cards/shared';
import { diamondLayout } from './diamondLayout';
import { DETAIL_BACKGROUND, stageTheme } from './stageStyles';

// Diamonds scattered over a midnight-blue backdrop behind the card detail, slowly shifting between
// shades of the card's rarity colour. 40 shapes in fixed random places and sizes (diamondLayout), each driven by a Reanimated CSS animation on the UI thread
// (no per-frame JS). Reduce Motion leaves them still.

const IMAGE_DIM = 'rgba(8,6,12,0.55)';

type RarityBackgroundProps = {
  stage: RestaurantStage;
  /** A prepared background picture. It sits under the diamonds, dimmed. */
  image?: ImageSourcePropType;
};

export function RarityBackground({ stage, image }: RarityBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { shades, glow } = stageTheme(stage);
  const mid = shades[1];

  // Between the rarity's mid shade and its glow colour, kept faint so text over it stays readable.
  const keyframes = useMemo(
    () => ({
      '0%': { backgroundColor: mid, opacity: 0.5, transform: [{ rotate: '45deg' }, { scale: 0.94 }] },
      '50%': { backgroundColor: glow, opacity: 0.3, transform: [{ rotate: '45deg' }, { scale: 1.04 }] },
      '100%': { backgroundColor: mid, opacity: 0.5, transform: [{ rotate: '45deg' }, { scale: 0.94 }] },
    }),
    [mid, glow],
  );

  const diamonds = useMemo(() => diamondLayout(width, height), [width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DETAIL_BACKGROUND }]}>
      {image ? (
        <>
          <Animated.Image source={image} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: IMAGE_DIM }]} />
        </>
      ) : null}
      {diamonds.map(({ key, left, top, size, durationMs, delayMs }) => (
        <Animated.View
          key={key}
          style={[
            { position: 'absolute', left, top, width: size, height: size, borderRadius: size * 0.08 },
            reducedMotion
              ? { backgroundColor: key % 2 ? mid : glow, opacity: 0.35, transform: [{ rotate: '45deg' }] }
              : { animationName: keyframes, animationDuration: durationMs, animationDelay: delayMs, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' },
          ]}
        />
      ))}
    </View>
  );
}
