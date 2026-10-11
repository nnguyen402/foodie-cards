import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

// The "noodles" avatar: a steaming ramen bowl in a vintage illustration style (bold dark
// outlines, warm reds, cream and gold). Drawn on a 120-unit square and scaled to `size`.
// Three layers so only small views move: the bowl (static), the steam wisps (rise and fade)
// and the chopsticks lifting a noodle (bob ±3px). All motion is Reanimated CSS animation on
// the UI thread; Reduce Motion shows a still frame with the steam half visible.

const VIEWBOX = '0 0 120 120';
const UNITS = 120;

const ink = '#2B1410';
const bowlRed = '#C8372D';
const bowlRedDeep = '#9E2A22';
const cream = '#F3E6CF';
const brothBack = '#C97A26';
const broth = '#EBA845';
const noodle = '#F6CF63';
const noodleEdge = '#A8701B';
const scallion = '#7BB661';
const scallionEdge = '#3E6B2C';
const stick = '#B07443';
const backdrop = '#2B3A40';
const backdropInner = '#34474E';
const steam = '#FFF6E8';

/** Steam wisps: x positions in the 120-unit drawing, and when each starts. */
const WISPS = [
  { x: 30, delayMs: 0 },
  { x: 44, delayMs: 900 },
  { x: 56, delayMs: 1800 },
] as const;
const STEAM_MS = 2700;
const BOB_MS = 3000;
const BOB_PX = 3;

const NOODLE_ROWS = [
  'M14 62 q 5 -4 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0',
  'M10 67 q 5 4 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0',
  'M16 72 q 5 -4 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0',
] as const;

const SCALLIONS: readonly [number, number][] = [[54, 61], [60, 70], [30, 69], [69, 60], [47, 71], [93, 68], [24, 63]];

function Bowl() {
  return (
    <>
      <Defs>
        <ClipPath id="noodle-broth">
          <Ellipse cx={60} cy={66} rx={43} ry={9} />
        </ClipPath>
        <ClipPath id="noodle-body">
          <Path d="M14 66 C 16 96, 40 108, 60 108 C 80 108, 104 96, 106 66 Z" />
        </ClipPath>
      </Defs>

      {/* Backdrop: a slate disc so the cream steam reads. */}
      <Circle cx={60} cy={60} r={60} fill={backdrop} />
      <Circle cx={60} cy={60} r={48} fill={backdropInner} />

      {/* Foot, then body. */}
      <Path d="M43 104 L 46 113 L 74 113 L 77 104 Z" fill={bowlRedDeep} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M14 66 C 16 96, 40 108, 60 108 C 80 108, 104 96, 106 66 Z" fill={bowlRed} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      <G clipPath="url(#noodle-body)">
        <Path d="M10 82 C 30 96, 90 96, 110 82" fill="none" stroke={cream} strokeWidth={7} />
        <Path d="M10 78.5 C 30 92.5, 90 92.5, 110 78.5" fill="none" stroke={ink} strokeWidth={1.2} />
        <Path d="M10 85.5 C 30 99.5, 90 99.5, 110 85.5" fill="none" stroke={ink} strokeWidth={1.2} />
        <Circle cx={40} cy={90} r={2} fill={bowlRed} />
        <Circle cx={60} cy={92.4} r={2} fill={bowlRed} />
        <Circle cx={80} cy={90} r={2} fill={bowlRed} />
      </G>
      <Path d="M24 76 C 26 87, 31 94, 39 99" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round" />

      {/* Broth with a darker back wall, then noodles and toppings, all inside the rim. */}
      <Ellipse cx={60} cy={66} rx={43} ry={9} fill={brothBack} />
      <G clipPath="url(#noodle-broth)">
        <Ellipse cx={60} cy={68} rx={42} ry={7.5} fill={broth} />
        {NOODLE_ROWS.map((d) => (
          <G key={d}>
            <Path d={d} fill="none" stroke={noodleEdge} strokeWidth={4.6} strokeLinecap="round" />
            <Path d={d} fill="none" stroke={noodle} strokeWidth={2.6} strokeLinecap="round" />
          </G>
        ))}
        {/* Fish cake with a pink swirl. */}
        <Circle cx={38} cy={63} r={6} fill="#FFF8EA" stroke={ink} strokeWidth={1.6} />
        <Path d="M38 63 m -3 0 a 3 3 0 1 1 3 3 a 1.6 1.6 0 1 1 -1.6 -1.6" fill="none" stroke="#E86A8E" strokeWidth={1.4} strokeLinecap="round" />
        {/* Egg half. */}
        <Ellipse cx={81} cy={64} rx={11} ry={6.5} fill="#FFF8EA" stroke={ink} strokeWidth={1.8} />
        <Ellipse cx={82} cy={64.3} rx={5} ry={3.3} fill="#F5A524" stroke="#C9781A" strokeWidth={1} />
        {SCALLIONS.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.1} fill={scallion} stroke={scallionEdge} strokeWidth={1} />
        ))}
      </G>

      {/* Rim: cream lip and a bold outline. */}
      <Ellipse cx={60} cy={66} rx={44.5} ry={10.2} fill="none" stroke={cream} strokeWidth={2.2} />
      <Ellipse cx={60} cy={66} rx={46} ry={11} fill="none" stroke={ink} strokeWidth={3.5} />
    </>
  );
}

function Chopsticks() {
  return (
    <>
      {/* Two noodles hanging from the tips back into the broth. */}
      {['M65 43 C 61 48, 69 52, 64 57 C 60 61, 64 63, 62 66', 'M70 44 C 67 49, 74 53, 69 58 C 66 61, 69 63, 68 66'].map((d) => (
        <G key={d}>
          <Path d={d} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <Path d={d} fill="none" stroke={noodle} strokeWidth={2.8} strokeLinecap="round" />
        </G>
      ))}
      {[{ x1: 110, y1: 4, x2: 63, y2: 42 }, { x1: 116, y1: 13, x2: 70, y2: 45 }].map(({ x1, y1, x2, y2 }) => (
        <G key={x1}>
          <Path d={`M${x1} ${y1} L ${x2} ${y2}`} stroke={ink} strokeWidth={6.4} strokeLinecap="round" />
          <Path d={`M${x1} ${y1} L ${x2} ${y2}`} stroke={stick} strokeWidth={3.6} strokeLinecap="round" />
        </G>
      ))}
    </>
  );
}

function Wisp({ x }: { x: number }) {
  const d = `M${x} 50 c -5 -5 5 -9 0 -14 c -5 -5 5 -9 0 -14`;
  return <Path d={d} fill="none" stroke={steam} strokeWidth={3} strokeLinecap="round" />;
}

export const NoodleAvatar = memo(function NoodleAvatar({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const unit = size / UNITS;

  const steamKeyframes = useMemo(() => ({
    '0%': { opacity: 0, transform: [{ translateY: 6 * unit }, { scaleY: 0.85 }] },
    '30%': { opacity: 0.9, transform: [{ translateY: 0 }, { scaleY: 1 }] },
    '100%': { opacity: 0, transform: [{ translateY: -16 * unit }, { scaleY: 1.1 }] },
  }), [unit]);

  const bobKeyframes = useMemo(() => ({
    '0%': { transform: [{ translateY: BOB_PX }] },
    '50%': { transform: [{ translateY: -BOB_PX }] },
    '100%': { transform: [{ translateY: BOB_PX }] },
  }), []);

  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]} accessible={false}>
      <Svg width={size} height={size} viewBox={VIEWBOX} style={StyleSheet.absoluteFill}>
        <Bowl />
      </Svg>
      {WISPS.map(({ x, delayMs }) => (
        <Animated.View
          key={x}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            reducedMotion
              ? { opacity: 0.55 }
              : { opacity: 0, animationName: steamKeyframes, animationDuration: STEAM_MS, animationDelay: delayMs, animationIterationCount: 'infinite', animationTimingFunction: 'ease-out' },
          ]}
        >
          <Svg width={size} height={size} viewBox={VIEWBOX}>
            <Wisp x={x} />
          </Svg>
        </Animated.View>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          reducedMotion
            ? null
            : { animationName: bobKeyframes, animationDuration: BOB_MS, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' },
        ]}
      >
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Chopsticks />
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
