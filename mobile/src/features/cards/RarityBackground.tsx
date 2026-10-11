import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { RestaurantStage } from '@foodie-cards/shared';
import { stageTheme } from './stageStyles';

// A lattice of diamonds behind the card detail, slowly shifting between dark shades of the
// card's rarity colour. 40 shapes, each driven by a Reanimated CSS animation on the UI thread
// (no per-frame JS). Reduce Motion leaves them still. The shades are dark so text stays readable.

const COLUMNS = 5;
const ROWS = 8;
const MIN_LOOP_MS = 6000;
const LOOP_STEP_MS = 700;
const IMAGE_DIM = 'rgba(8,6,12,0.55)';

type RarityBackgroundProps = {
  stage: RestaurantStage;
  /** A prepared background picture. It sits under the diamonds, dimmed. */
  image?: ImageSourcePropType;
};

export function RarityBackground({ stage, image }: RarityBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [dark, mid, light] = stageTheme(stage).shades;

  const keyframes = useMemo(
    () => ({
      '0%': { backgroundColor: dark, opacity: 0.55, transform: [{ rotate: '45deg' }, { scale: 0.92 }] },
      '50%': { backgroundColor: light, opacity: 0.95, transform: [{ rotate: '45deg' }, { scale: 1.04 }] },
      '100%': { backgroundColor: dark, opacity: 0.55, transform: [{ rotate: '45deg' }, { scale: 0.92 }] },
    }),
    [dark, light],
  );

  const diamonds = useMemo(() => {
    const cell = width / (COLUMNS - 0.5);
    const size = cell * 0.6;
    const rowStep = height / (ROWS - 1);
    return Array.from({ length: COLUMNS * ROWS }, (_, index) => {
      const row = Math.floor(index / COLUMNS);
      const column = index % COLUMNS;
      return {
        key: index,
        left: column * cell + (row % 2 ? cell / 2 : 0) + cell / 2 - size / 2,
        top: row * rowStep - size / 2,
        size,
        durationMs: MIN_LOOP_MS + ((index * 37) % 5) * LOOP_STEP_MS,
        // A diagonal wave, so neighbouring diamonds are never in step.
        delayMs: (row + column) * 450,
      };
    });
  }, [width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark }]}>
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
              ? { backgroundColor: key % 2 ? mid : dark, opacity: 0.7, transform: [{ rotate: '45deg' }] }
              : { animationName: keyframes, animationDuration: durationMs, animationDelay: delayMs, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' },
          ]}
        />
      ))}
    </View>
  );
}
