import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { seededRandom } from '../cards/frameLayout';
import { gradient } from '../cards/gradient';

// Everything decorative above the map, in one layer that never takes touches: a warm night
// tint, an edge vignette, a few slow clouds and faint twinkles. Keyframes only, so nothing
// here runs JavaScript per frame; with Reduce Motion it is all still.

const TINT = 'rgba(255,138,76,0.10)';
const NIGHT = 'rgba(36,18,64,0.16)';
const VIGNETTE = 'radial-gradient(ellipse at 50% 50%, rgba(10,6,20,0) 52%, rgba(10,6,20,0.62) 100%)';
const CLOUDS = [
  { top: 0.07, width: 190, drift: 0.55, durationMs: 62000, opacity: 0.16 },
  { top: 0.15, width: 130, drift: -0.5, durationMs: 78000, opacity: 0.12 },
  { top: 0.03, width: 240, drift: 0.4, durationMs: 94000, opacity: 0.1 },
] as const;
const TWINKLES = 12;

const twinkle = { '0%': { opacity: 0.08 }, '50%': { opacity: 0.85 }, '100%': { opacity: 0.08 } };

function Cloud({ width, opacity }: { width: number; opacity: number }) {
  const height = width * 0.34;
  const puff = (left: number, top: number, size: number) => ({ position: 'absolute', left: width * left, top: height * top, width: width * size, height: width * size, borderRadius: width * size, backgroundColor: '#fff6ea' }) as const;
  return (
    <View style={{ width, height, opacity }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.55, borderRadius: height, backgroundColor: '#fff6ea' }} />
      <View style={puff(0.14, 0.1, 0.3)} />
      <View style={puff(0.36, -0.12, 0.36)} />
      <View style={puff(0.62, 0.16, 0.26)} />
    </View>
  );
}

export const MapAtmosphere = memo(function MapAtmosphere() {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const twinkles = useMemo(() => {
    const next = seededRandom(57);
    return Array.from({ length: TWINKLES }, (_, index) => ({
      key: `twinkle-${index}`,
      left: next() * width,
      top: next() * height * 0.8,
      size: 2 + next() * 2.5,
      durationMs: 2200 + next() * 2600,
      delayMs: next() * 3000,
    }));
  }, [width, height]);

  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: TINT }]} />
      {twinkles.map(({ key, left, top, size, durationMs, delayMs }) => (
        <Animated.View
          key={key}
          style={[{ position: 'absolute', left, top, width: size, height: size, borderRadius: size, backgroundColor: '#ffe9b8', opacity: 0.3 },
            reducedMotion ? null : { animationName: twinkle, animationDuration: durationMs, animationDelay: delayMs, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }]}
        />
      ))}
      {CLOUDS.map((cloud, index) => (
        <Animated.View
          key={`cloud-${index}`}
          style={[{ position: 'absolute', top: height * cloud.top, left: width * (0.5 - cloud.drift / 2) - cloud.width / 2 },
            reducedMotion ? null : {
              animationName: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: width * cloud.drift }] } },
              animationDuration: cloud.durationMs, animationIterationCount: 'infinite', animationDirection: 'alternate', animationTimingFunction: 'ease-in-out',
            }]}
        >
          <Cloud width={cloud.width} opacity={cloud.opacity} />
        </Animated.View>
      ))}
      <View style={[StyleSheet.absoluteFill, gradient(VIGNETTE, 'transparent')]} />
    </View>
  );
});
