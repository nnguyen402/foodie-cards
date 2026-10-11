import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { RestaurantStage } from '@foodie-cards/shared';
import { OBSIDIAN_GRADIENT, obsidian } from '../profile/obsidian';
import { diamondLayout } from './diamondLayout';
import { DETAIL_BACKGROUND, stageTheme } from './stageStyles';

// Diamonds scattered over a backdrop, each driven by a Reanimated CSS animation on the UI thread
// (no per-frame JS). 40 shapes in fixed random places and sizes (diamondLayout). Reduce Motion
// leaves them still.
//   rarity (default): midnight blue, diamonds shifting between shades of the card's rarity colour
//                     (the card detail).
//   obsidian:         black into charcoal, faint silver diamonds that drift and pulse (Profile).

const IMAGE_DIM = 'rgba(8,6,12,0.55)';
/** How far an obsidian diamond drifts up and back, in points. */
const OBSIDIAN_DRIFT = 10;

type RarityBackgroundProps =
  | {
      palette?: 'rarity';
      stage: RestaurantStage;
      /** A prepared background picture. It sits under the diamonds, dimmed. */
      image?: ImageSourcePropType;
    }
  | { palette: 'obsidian'; stage?: undefined; image?: undefined };

export function RarityBackground(props: RarityBackgroundProps) {
  return props.palette === 'obsidian' ? <ObsidianBackground /> : <RarityDiamonds stage={props.stage} image={props.image} />;
}

function RarityDiamonds({ stage, image }: { stage: RestaurantStage; image?: ImageSourcePropType }) {
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

// Silver at low opacity: visible as texture, never competing with the text above it.
const OBSIDIAN_KEYFRAMES = {
  '0%': { backgroundColor: obsidian.silverDeep, opacity: 0.08, transform: [{ translateY: 0 }, { rotate: '45deg' }, { scale: 0.92 }] },
  '50%': { backgroundColor: obsidian.silver, opacity: 0.18, transform: [{ translateY: -OBSIDIAN_DRIFT }, { rotate: '45deg' }, { scale: 1.04 }] },
  '100%': { backgroundColor: obsidian.silverDeep, opacity: 0.08, transform: [{ translateY: 0 }, { rotate: '45deg' }, { scale: 0.92 }] },
};

function ObsidianBackground() {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const diamonds = useMemo(() => diamondLayout(width, height), [width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: obsidian.charcoal }]}>
      <LinearGradient colors={OBSIDIAN_GRADIENT} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      {diamonds.map(({ key, left, top, size, durationMs, delayMs }) => (
        <Animated.View
          key={key}
          style={[
            { position: 'absolute', left, top, width: size, height: size, borderRadius: size * 0.08 },
            reducedMotion
              ? { backgroundColor: key % 2 ? obsidian.silverDeep : obsidian.silver, opacity: 0.1, transform: [{ rotate: '45deg' }] }
              : {
                  animationName: OBSIDIAN_KEYFRAMES,
                  // A touch slower than the card detail: the profile should feel calm.
                  animationDuration: Math.round(durationMs * 1.4),
                  animationDelay: delayMs,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
      ))}
    </View>
  );
}
