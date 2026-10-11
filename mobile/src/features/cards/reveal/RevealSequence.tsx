import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RestaurantStage } from '@foodie-cards/shared';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { RestaurantCard } from '../RestaurantCard';
import { frameRects } from '../frameLayout';
import { gradient } from '../gradient';
import { stageLabel } from '../stageStyles';
import type { CardView } from '../types';
import { CardBack } from './CardBack';
import { rattleOffsets, shakeOffsets } from './particles';
import { Dim, FrontLayer, Rays, RingLayer, ShineSweep, type Arena, type EffectBody, type EffectItem } from './RevealEffects';
import { REDUCED_FADE_MS, revealScript, type RevealEvent } from './script';
import { StageTitle } from './StageTitle';

export type RevealSequenceProps = {
  /** The card as it is after the reward. */
  card: CardView;
  /** Null for a first unlock. */
  previousStage: RestaurantStage | null;
  /** When set, shown as a banner at the top. */
  demoLabel?: string;
  /** Called once: when the animation reaches its end or Skip is pressed. */
  onViewed: () => void;
  onClose: () => void;
};

type Phase = 'sealed' | 'playing' | 'done';
// How the title and the card glow appear: not yet, animated, already settled (Skip), or faded (Reduce Motion).
type Shown = 'no' | 'animated' | 'instant' | 'fade';

const THEATRE = 'radial-gradient(circle at 50% 50%, #2a2017 0%, #120e0b 72%)';
const INK = '#f6ede2';
const PERSPECTIVE = 1100;
const CARD_MAX_WIDTH = 300;
const CARD_WIDTH_SHARE = 0.72;
// The card is up to this much larger mid-spin, and still has to clear the title and buttons.
const FIT_SCALE = 1.15;
const SKIP_ROW = 52;
const DEMO_ROW = 36;
const TITLE_BLOCK = 112;
const BOTTOM_BLOCK = 140;
const GLOW_FADE_MS = 500;

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const OVERSHOOT = Easing.bezier(0.3, 1.6, 0.5, 1);

const promptPulse = { '0%': { opacity: 0.45 }, '50%': { opacity: 1 }, '100%': { opacity: 0.45 } } as const;
const summaryFade = { from: { opacity: 0, transform: [{ translateY: 8 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } } as const;
const glowFade = { from: { opacity: 0 }, to: { opacity: 1 } } as const;

export function RevealSequence({ card, previousStage, demoLabel, onViewed, onClose }: RevealSequenceProps) {
  const reducedMotion = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const script = useMemo(() => revealScript(card.stage), [card.stage]);
  const { name } = card.restaurant;

  const [phase, setPhase] = useState<Phase>('sealed');
  const [shown, setShown] = useState<Shown>('no');
  const [effects, setEffects] = useState<EffectItem[]>([]);
  const [shine, setShine] = useState<{ durationMs: number; iterations: number } | null>(null);
  const [rays, setRays] = useState<number | null>(null);
  const [dimmed, setDimmed] = useState(false);

  const rotation = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const rattle = useSharedValue(0);
  const sceneX = useSharedValue(0);
  const sceneY = useSharedValue(0);
  const dim = useSharedValue(0);
  const raysOpacity = useSharedValue(0);
  const fade = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const effectId = useRef(0);
  const viewed = useRef(false);
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;

  const topReserve = insets.top + SKIP_ROW + (demoLabel ? DEMO_ROW : 0) + TITLE_BLOCK;
  const availableHeight = Math.max(0, windowHeight - topReserve - insets.bottom - BOTTOM_BLOCK);
  const cardWidth = Math.floor(Math.max(120, Math.min(CARD_MAX_WIDTH, windowWidth * CARD_WIDTH_SHARE, availableHeight / (1.4 * FIT_SCALE))));
  const rects = useMemo(() => frameRects(cardWidth), [cardWidth]);
  const arena = useMemo<Arena>(
    () => ({ width: windowWidth, height: windowHeight, cx: windowWidth / 2, cy: topReserve + availableHeight / 2 }),
    [windowWidth, windowHeight, topReserve, availableHeight],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const started = useRef(false);
  const markViewed = useCallback(() => {
    if (viewed.current) return;
    viewed.current = true;
    onViewedRef.current();
  }, []);

  const addEffect = useCallback((item: EffectBody) => {
    effectId.current += 1;
    setEffects((list) => [...list, { ...item, id: effectId.current } as EffectItem]);
  }, []);

  const finish = useCallback((skipped: boolean) => {
    clearTimers();
    [rotation, cardScale, rattle, sceneX, sceneY, dim, raysOpacity, fade].forEach(cancelAnimation);
    rotation.set(reducedMotion ? 0 : script.spin.turnDeg);
    cardScale.set(1);
    rattle.set(0);
    sceneX.set(0);
    sceneY.set(0);
    fade.set(1);
    setEffects([]);
    setShine(null);
    if (skipped) {
      dim.set(0);
      raysOpacity.set(0);
      setRays(null);
      setDimmed(false);
      setShown((current) => (current === 'no' || current === 'animated' ? 'instant' : current));
    }
    setPhase('done');
    markViewed();
  }, [clearTimers, rotation, cardScale, rattle, sceneX, sceneY, dim, raysOpacity, fade, reducedMotion, script, markViewed]);

  const apply = useCallback((event: RevealEvent) => {
    switch (event.kind) {
      case 'dim':
        setDimmed(true);
        dim.set(withTiming(event.fade.to, { duration: event.fade.durationMs, easing: EASE_OUT }));
        break;
      case 'rays':
        setRays(event.fade.periodMs);
        raysOpacity.set(withTiming(event.fade.to, { duration: event.fade.durationMs, easing: EASE_OUT }));
        break;
      case 'rattle': {
        const { stepMs, offsets } = rattleOffsets(event.shake.amplitude, event.shake.durationMs);
        rattle.set(withSequence(...offsets.map((offset) => withTiming(offset, { duration: stepMs, easing: Easing.linear }))));
        break;
      }
      case 'pulse': {
        const rise = Math.round(event.pulse.beatMs * 0.35);
        cardScale.set(withSequence(
          withTiming(event.pulse.peakScale, { duration: rise, easing: OVERSHOOT }),
          withTiming(1, { duration: event.pulse.beatMs - rise, easing: EASE_OUT }),
        ));
        break;
      }
      case 'shake': {
        const { stepMs, points } = shakeOffsets(event.shake.amplitude, event.shake.durationMs, event.atMs + 1);
        sceneX.set(withSequence(...points.map((point) => withTiming(point.x, { duration: stepMs, easing: Easing.linear }))));
        sceneY.set(withSequence(...points.map((point) => withTiming(point.y, { duration: stepMs, easing: Easing.linear }))));
        break;
      }
      case 'flash':
        addEffect({ kind: 'flash', flash: event.flash });
        break;
      case 'ring':
        addEffect({ kind: 'ring', ring: event.ring });
        break;
      case 'burst':
        addEffect({ kind: 'burst', burst: event.burst });
        break;
      case 'stream':
        addEffect({ kind: 'stream', stream: event.stream });
        break;
      case 'shine':
        setShine({ durationMs: event.durationMs, iterations: event.iterations });
        break;
      case 'spin': {
        const { spin } = script;
        rotation.set(withTiming(spin.turnDeg, { duration: spin.durationMs, easing: Easing.bezier(...spin.easing) }));
        cardScale.set(withSequence(
          withTiming(spin.restScale, { duration: spin.liftMs, easing: EASE_IN_OUT }),
          withTiming(spin.peakScale, { duration: spin.durationMs * spin.peakAt - spin.liftMs, easing: EASE_IN_OUT }),
          withTiming(spin.restScale, { duration: spin.durationMs * (1 - spin.peakAt), easing: EASE_IN_OUT }),
          withTiming(1, { duration: spin.settleMs, easing: EASE_OUT }),
        ));
        break;
      }
      case 'landed':
        setShown('animated');
        break;
      case 'cleanup':
        setEffects([]);
        setShine(null);
        break;
      case 'end':
        finish(false);
        break;
    }
  }, [addEffect, cardScale, dim, finish, raysOpacity, rattle, rotation, sceneX, sceneY, script]);

  const reveal = useCallback(() => {
    if (phase !== 'sealed' || started.current) return;
    started.current = true;
    setPhase('playing');
    if (reducedMotion) {
      fade.set(withTiming(1, { duration: REDUCED_FADE_MS }));
      setShown('fade');
      timers.current.push(setTimeout(() => finish(false), REDUCED_FADE_MS));
      return;
    }
    const times = [...new Set(script.events.map((event) => event.atMs))];
    for (const atMs of times) {
      timers.current.push(setTimeout(() => script.events.filter((event) => event.atMs === atMs).forEach(apply), atMs));
    }
  }, [phase, reducedMotion, fade, finish, script, apply]);

  const skip = useCallback(() => finish(true), [finish]);

  useEffect(() => {
    if (phase === 'done') AccessibilityInfo.announceForAccessibility(`${name}, ${script.label} card`);
  }, [phase, name, script.label]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { translateX: rattle.get() }, { scale: cardScale.get() }, { rotateY: `${rotation.get()}deg` }],
  }));
  const sceneStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sceneX.get() }, { translateY: sceneY.get() }] }));
  // Without backfaceVisibility, the face turned towards the viewer is the one whose angle has the right cosine sign.
  const frontStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? fade.get() : Math.cos((rotation.get() * Math.PI) / 180) < 0 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 - fade.get() : Math.cos((rotation.get() * Math.PI) / 180) > 0 ? 1 : 0,
  }));

  const summary = previousStage === null ? 'New card unlocked' : `Evolved from ${stageLabel(previousStage)} to ${script.label}`;
  const resting = phase === 'done';

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradient(THEATRE, '#120e0b')]} />

      {rays === null ? null : <Rays opacity={raysOpacity} arena={arena} color={script.glow} periodMs={rays} />}
      {dimmed ? <Dim opacity={dim} arena={arena} /> : null}

      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, sceneStyle]}>
        <RingLayer items={effects} arena={arena} />
        <Animated.View style={[{ position: 'absolute', left: arena.cx - cardWidth / 2, top: arena.cy - rects.height / 2, width: cardWidth, height: rects.height }, cardStyle]}>
          {script.cardGlow && shown !== 'no' ? (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: rects.radius, backgroundColor: '#000000', boxShadow: script.cardGlow },
                shown === 'instant' ? null : { opacity: 0, animationName: glowFade, animationDuration: shown === 'fade' ? REDUCED_FADE_MS : GLOW_FADE_MS, animationFillMode: 'forwards' }]}
            />
          ) : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backStyle]}>
            <CardBack width={cardWidth} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden={!resting}
            importantForAccessibility={resting ? 'yes' : 'no-hide-descendants'}
            style={[StyleSheet.absoluteFill, frontStyle]}
          >
            <View style={[StyleSheet.absoluteFill, reducedMotion ? null : styles.mirrored]}>
              <RestaurantCard card={card} width={cardWidth} />
              {shine ? <ShineSweep width={cardWidth} height={rects.height} radius={rects.radius} {...shine} /> : null}
            </View>
          </Animated.View>
          <Pressable
            accessible={phase === 'sealed'}
            accessibilityRole="button"
            accessibilityLabel="Reveal your card"
            disabled={phase !== 'sealed'}
            onPress={reveal}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>

      <FrontLayer items={effects} arena={arena} />

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top }]}>
        <View style={styles.skipRow}>
          {resting ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel="Skip animation" onPress={skip} hitSlop={8} style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>
        {demoLabel ? (
          <View style={styles.demo}>
            <Text style={styles.demoText}>{demoLabel}</Text>
          </View>
        ) : null}
      </View>

      {shown === 'no' ? null : (
        <View pointerEvents="none" style={[styles.title, { top: topReserve - TITLE_BLOCK + 8 }]}>
          <StageTitle script={script} restaurantName={name} instant={shown === 'instant'} fade={shown === 'fade'} />
        </View>
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {phase === 'sealed' ? (
          <Animated.Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.prompt, reducedMotion ? null : { animationName: promptPulse, animationDuration: 1800, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }]}
          >
            Tap to reveal
          </Animated.Text>
        ) : null}
        {resting ? (
          <Animated.View style={[styles.summary, reducedMotion ? null : { animationName: summaryFade, animationDuration: 300, animationFillMode: 'both' }]}>
            <Text style={styles.summaryText}>{summary}</Text>
            <Button label="Done" onPress={onClose} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120e0b', overflow: 'hidden' },
  // The front is drawn mirrored so that the 540 degree spin leaves it reading the right way round.
  mirrored: { transform: [{ scaleX: -1 }] },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16 },
  skipRow: { height: SKIP_ROW, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(246,237,226,0.14)' },
  skipText: { color: INK, fontSize: 16, fontWeight: '700' },
  demo: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: '#f2b632' },
  demoText: { color: '#1b130b', fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { position: 'absolute', left: 0, right: 0 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, alignItems: 'center', minHeight: BOTTOM_BLOCK },
  prompt: { color: INK, fontSize: 16, fontWeight: '600', letterSpacing: 1.2, paddingTop: 16 },
  summary: { width: '100%', gap: 16, alignItems: 'center' },
  summaryText: { color: INK, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
