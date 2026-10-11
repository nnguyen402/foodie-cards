import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { frameRects } from './frameLayout';
import { CardBack } from './reveal/CardBack';
import { stageLabel, stageTheme } from './stageStyles';
import type { RestaurantStage } from '@foodie-cards/shared';

// Tap a collected card and it turns a full 360° around its vertical axis, showing the card
// back halfway, then the rarity label lands with a glow in the rarity colour. Reduce Motion
// swaps the turn for a short fade.

export const SPIN_MS = 900;
const FADE_MS = 220;
const PERSPECTIVE = 900;

type SpinCardProps = {
  width: number;
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Fires when a spin starts, e.g. to play the rarity flourish. */
  onSpin?: () => void;
  /** Fires `afterMs` into the spin (or the fade), e.g. to open the card once it has turned. */
  onAfter?: () => void;
  afterMs?: number;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

export function SpinCard({ width, children, accessibilityLabel, accessibilityHint, onSpin, onAfter, afterMs = SPIN_MS, onPressIn, onPressOut }: SpinCardProps) {
  const reducedMotion = useReducedMotion();
  const angle = useSharedValue(0);
  const dim = useSharedValue(1);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const height = frameRects(width).height;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const turn = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ perspective: PERSPECTIVE }, { rotateY: `${angle.value}deg` }] }));

  const play = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    onSpin?.();
    const total = reducedMotion ? FADE_MS * 2 : SPIN_MS;
    if (reducedMotion) {
      dim.value = withSequence(withTiming(0.35, { duration: FADE_MS }), withTiming(1, { duration: FADE_MS }));
    } else {
      angle.value = 0;
      angle.value = withTiming(360, { duration: SPIN_MS, easing: Easing.inOut(Easing.cubic) });
    }
    if (onAfter) timers.current.push(setTimeout(onAfter, reducedMotion ? 0 : Math.min(afterMs, total)));
    timers.current.push(setTimeout(() => { busy.current = false; angle.value = 0; }, total + 50));
  }, [afterMs, angle, dim, onAfter, onSpin, reducedMotion]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} onPress={play} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[{ width, height }, turn]}>
        <View style={[StyleSheet.absoluteFill, styles.hidden]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{children}</View>
        <View style={[StyleSheet.absoluteFill, styles.hidden, styles.back]} pointerEvents="none"><CardBack width={width} /></View>
      </Animated.View>
    </Pressable>
  );
}

/** The rarity name under a card. Each time `playKey` changes it scales in with a glow in the rarity colour. */
export function RarityLabel({ stage, playKey, delayMs = SPIN_MS }: { stage: RestaurantStage; playKey: number; delayMs?: number }) {
  const reducedMotion = useReducedMotion();
  const { glow, label } = stageTheme(stage);
  const scale = useSharedValue(1);
  const glowRadius = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (playKey === 0) return;
    if (reducedMotion) {
      opacity.value = withDelay(delayMs, withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: FADE_MS })));
      glowRadius.value = withDelay(delayMs, withSequence(withTiming(10, { duration: 0 }), withTiming(0, { duration: 600 })));
      return;
    }
    scale.value = withDelay(delayMs, withSequence(withTiming(0.5, { duration: 0 }), withTiming(1.25, { duration: 240, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 180 })));
    glowRadius.value = withDelay(delayMs, withSequence(withTiming(0, { duration: 0 }), withTiming(22, { duration: 260 }), withTiming(6, { duration: 700 })));
  }, [playKey, delayMs, reducedMotion, scale, glowRadius, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }], textShadowRadius: glowRadius.value }));

  return (
    <Animated.Text
      accessibilityRole="text"
      style={[styles.rarity, { color: label, textShadowColor: glow, textShadowOffset: { width: 0, height: 0 } }, style]}
    >
      {stageLabel(stage)}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  hidden: { backfaceVisibility: 'hidden' },
  back: { transform: [{ rotateY: '180deg' }] },
  rarity: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' },
});
