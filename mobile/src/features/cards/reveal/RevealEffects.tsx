import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { gradient } from '../gradient';
import { burstParticles, streamParticles, type Particle, type StreamParticle } from './particles';
import type { BurstSpec, Flash, RingSpec, StreamSpec } from './script';

// Everything here is mounted at the moment it should play and animates through
// Reanimated CSS keyframes, so it runs on the UI thread without per-frame JS.
// Each layer resets to invisible once its animation ends.

export type EffectBody =
  | { kind: 'ring'; ring: RingSpec }
  | { kind: 'flash'; flash: Flash }
  | { kind: 'burst'; burst: BurstSpec }
  | { kind: 'stream'; stream: StreamSpec };
export type EffectItem = { id: number } & EffectBody;

export type Arena = { width: number; height: number; cx: number; cy: number };

const RING_SIZE = 120;
const RAY_COUNT = 24;
const RAY_WIDTHS = [14, 8] as const;

function Decoration({ children }: { children: React.ReactNode }) {
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>{children}</View>;
}

const ringKeyframes = (scale: number) => ({
  from: { transform: [{ scale: 0.2 }], opacity: 1 },
  to: { transform: [{ scale }], opacity: 0 },
});

const Ring = memo(function Ring({ spec, arena }: { spec: RingSpec; arena: Arena }) {
  const keyframes = useMemo(() => ringKeyframes(spec.scale), [spec.scale]);
  return (
    <Animated.View style={{
      position: 'absolute', left: arena.cx - RING_SIZE / 2, top: arena.cy - RING_SIZE / 2, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
      borderWidth: spec.widthPx, borderColor: spec.color, opacity: 0, boxShadow: `0 0 24px ${spec.color}, inset 0 0 18px ${spec.color}`,
      animationName: keyframes, animationDuration: spec.durationMs, animationTimingFunction: cubicBezier(0.1, 0.7, 0.3, 1),
    }} />
  );
});

const flashKeyframes = (opacity: number) => ({ '0%': { opacity: 0 }, '15%': { opacity }, '100%': { opacity: 0 } });

const FlashLayer = memo(function FlashLayer({ spec }: { spec: Flash }) {
  const keyframes = useMemo(() => flashKeyframes(spec.opacity), [spec.opacity]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, {
      backgroundColor: spec.color, opacity: 0, animationName: keyframes, animationDuration: spec.durationMs, animationTimingFunction: 'ease-out',
    }]} />
  );
});

function shapeStyle(particle: Particle): ViewStyle {
  const { size, color, shape } = particle;
  if (shape === 'spark') return { width: size * 0.5, height: size * 1.8, borderRadius: size, backgroundColor: color };
  if (shape === 'leaf') return { width: size, height: size / 2, borderRadius: 1, backgroundColor: color };
  const glow = shape === 'ember' ? { boxShadow: `0 0 ${size * 1.5}px ${color}` } : null;
  return { width: size, height: size, borderRadius: size / 2, backgroundColor: color, ...glow };
}

const burstKeyframes = (particle: Particle) => {
  const rotate = `${particle.rotateDeg - 90}deg` as const;
  return {
    '0%': { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate }, { scale: 1 }], opacity: 1 },
    '65%': { opacity: 0.8 },
    '100%': { transform: [{ translateX: particle.dx }, { translateY: particle.dy }, { rotate }, { scale: 0.4 }], opacity: 0 },
  };
};

function BurstParticle({ particle }: { particle: Particle }) {
  const keyframes = useMemo(() => burstKeyframes(particle), [particle]);
  return (
    <Animated.View style={[styles.particle, shapeStyle(particle), {
      left: -particle.size / 2, top: -particle.size / 2, animationName: keyframes, animationDuration: particle.durationMs, animationTimingFunction: cubicBezier(0.15, 0.6, 0.3, 1),
    }]} />
  );
}

const Burst = memo(function Burst({ spec, arena }: { spec: BurstSpec; arena: Arena }) {
  const particles = useMemo(() => burstParticles(spec.count, spec.colors, spec.speed, spec.seed), [spec]);
  return (
    <View style={{ position: 'absolute', left: arena.cx, top: arena.cy, width: 0, height: 0 }}>
      {particles.map((particle, index) => <BurstParticle key={index} particle={particle} />)}
    </View>
  );
});

// Embers rise with a slight sideways wobble; leaves fall, tumble and flatten as they turn.
const streamKeyframes = (particle: StreamParticle) => {
  const { dx, dy, wobble, shape, rotateDeg, spinDeg } = particle;
  const sway = [0, 1, -1, 1, 0];
  const flap = [1, 0.3, 1, 0.3, 1];
  const frames: Record<string, ViewStyle> = {};
  [0, 25, 50, 75, 100].forEach((at, index) => {
    const t = at / 100;
    const move = [{ translateX: dx * t + sway[index] * wobble }, { translateY: dy * t }];
    frames[`${at}%`] = {
      transform: shape === 'leaf' ? [...move, { rotate: `${rotateDeg + spinDeg * t}deg` as const }, { scaleY: flap[index] }] : move,
      opacity: at === 0 || at === 100 ? 0 : at === 75 ? 0.7 : 1,
    };
  });
  return frames;
};

function StreamParticleView({ particle }: { particle: StreamParticle }) {
  const keyframes = useMemo(() => streamKeyframes(particle), [particle]);
  return (
    <Animated.View style={[styles.particle, shapeStyle(particle), {
      left: particle.x - particle.size / 2, top: particle.y, animationName: keyframes, animationDuration: particle.durationMs, animationDelay: particle.delayMs,
      animationIterationCount: particle.iterations, animationTimingFunction: 'linear',
    }]} />
  );
}

const Stream = memo(function Stream({ spec, arena }: { spec: StreamSpec; arena: Arena }) {
  const particles = useMemo(
    () => streamParticles(spec.kind, spec.count, spec.colors, spec.seed, arena, spec.durationMs),
    [spec, arena.width, arena.height], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <>{particles.map((particle, index) => <StreamParticleView key={index} particle={particle} />)}</>;
});

/** Rings that sit behind the card and shake with the scene. */
export function RingLayer({ items, arena }: { items: EffectItem[]; arena: Arena }) {
  return (
    <Decoration>
      {items.map((item) => (item.kind === 'ring' ? <Ring key={item.id} spec={item.ring} arena={arena} /> : null))}
    </Decoration>
  );
}

/** Flashes, bursts and streams that sit above everything, still while the scene shakes. */
export function FrontLayer({ items, arena }: { items: EffectItem[]; arena: Arena }) {
  return (
    <Decoration>
      {items.map((item) => {
        if (item.kind === 'flash') return <FlashLayer key={item.id} spec={item.flash} />;
        if (item.kind === 'burst') return <Burst key={item.id} spec={item.burst} arena={arena} />;
        if (item.kind === 'stream') return <Stream key={item.id} spec={item.stream} arena={arena} />;
        return null;
      })}
    </Decoration>
  );
}

const spinKeyframes = {
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
};

// Thin bars fanned around the card, fading outward. One container turns them all.
export function Rays({ opacity, arena, color, periodMs }: { opacity: SharedValue<number>; arena: Arena; color: string; periodMs: number }) {
  const length = Math.max(arena.width, arena.height) * 0.8;
  const bars = useMemo(() => Array.from({ length: RAY_COUNT }, (_, index) => {
    const width = RAY_WIDTHS[index % RAY_WIDTHS.length];
    return {
      position: 'absolute', left: -width / 2, top: -length, width, height: length,
      borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2,
      ...gradient(`linear-gradient(to top, ${color}, transparent)`, 'transparent'),
      transform: [{ rotate: `${(index * 360) / RAY_COUNT}deg` }], transformOrigin: '50% 100%',
    } satisfies ViewStyle;
  }), [length, color]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, fade]}>
      <Animated.View
        key={periodMs}
        style={{ position: 'absolute', left: arena.cx, top: arena.cy, width: 0, height: 0, animationName: spinKeyframes, animationDuration: periodMs, animationIterationCount: 'infinite', animationTimingFunction: 'linear' }}
      >
        {bars.map((bar, index) => <View key={index} style={bar} />)}
      </Animated.View>
    </Animated.View>
  );
}

// Darkens the room around the card.
export function Dim({ opacity, arena }: { opacity: SharedValue<number>; arena: Arena }) {
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const centreY = Math.round((arena.cy / arena.height) * 100);
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, gradient(`radial-gradient(circle at 50% ${centreY}%, rgba(0,0,0,0.2), #000000 70%)`, '#000000'), fade]}
    />
  );
}

const SHINE = 'linear-gradient(110deg, rgba(255,226,140,0) 30%, rgba(255,226,140,0.85) 48%, rgba(255,226,140,0) 66%)';

// A gold band crossing the card face, clipped to the card's rounded corners.
export function ShineSweep({ width, height, radius, durationMs, iterations }: { width: number; height: number; radius: number; durationMs: number; iterations: number }) {
  const keyframes = useMemo(() => ({
    from: { transform: [{ translateX: width * 0.5 }] },
    to: { transform: [{ translateX: width * -1.4 }] },
  }), [width]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Animated.View style={[{
        position: 'absolute', left: 0, top: 0, width: width * 2, height,
        animationName: keyframes, animationDuration: durationMs, animationIterationCount: iterations, animationTimingFunction: 'ease-out', animationFillMode: 'forwards',
      }, gradient(SHINE, 'transparent')]} />
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', opacity: 0 },
});
