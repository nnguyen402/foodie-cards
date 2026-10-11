import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { CuisineIcon } from '../cards/CuisineIcon';
import type { MapRestaurant } from './mapRestaurants';
import { idleMotion, type IdleMotion } from './pinMotion';
import { pinLook } from './pinStyle';

// One map pin, drawn in code: a round badge with the cuisine icon. Locked pins are grey,
// dim and still; collected pins glow in their stage colour and, when `animate` is set,
// run the idle motion of their cuisine.

export const PIN_BOX = { width: 76, height: 84 };
const BADGE = 48;
const ICON = 28;

const loop = (durationMs: number, timing: 'linear' | 'ease-in-out' = 'ease-in-out') =>
  ({ animationDuration: durationMs, animationIterationCount: 'infinite', animationTimingFunction: timing }) as const;

const spin = { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } };
const bounce = { '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -4 }] }, '100%': { transform: [{ translateY: 0 }] } };
const bob = {
  '0%': { transform: [{ translateY: 1 }, { rotate: '-5deg' }] },
  '50%': { transform: [{ translateY: -2 }, { rotate: '5deg' }] },
  '100%': { transform: [{ translateY: 1 }, { rotate: '-5deg' }] },
};
const pulse = { '0%': { transform: [{ scale: 1 }] }, '50%': { transform: [{ scale: 1.1 }] }, '100%': { transform: [{ scale: 1 }] } };
const float = { '0%': { transform: [{ translateY: 1 }] }, '50%': { transform: [{ translateY: -2 }] }, '100%': { transform: [{ translateY: 1 }] } };
const steam = {
  '0%': { transform: [{ translateY: 4 }, { scaleY: 0.6 }], opacity: 0 },
  '40%': { opacity: 0.9 },
  '100%': { transform: [{ translateY: -8 }, { scaleY: 1.2 }], opacity: 0 },
};
const flicker = {
  '0%': { transform: [{ scaleY: 0.7 }], opacity: 0.6 },
  '30%': { transform: [{ scaleY: 1.15 }], opacity: 1 },
  '60%': { transform: [{ scaleY: 0.85 }], opacity: 0.75 },
  '100%': { transform: [{ scaleY: 0.7 }], opacity: 0.6 },
};
const glowPulse = { '0%': { opacity: 0.45, transform: [{ scale: 1 }] }, '50%': { opacity: 1, transform: [{ scale: 1.14 }] }, '100%': { opacity: 0.45, transform: [{ scale: 1 }] } };
const sparkle = {
  '0%': { opacity: 0, transform: [{ scale: 0.5 }, { rotate: '45deg' }] },
  '50%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '45deg' }] },
  '100%': { opacity: 0, transform: [{ scale: 0.5 }, { rotate: '45deg' }] },
};
const pop = {
  '0%': { transform: [{ scale: 1 }] },
  '40%': { transform: [{ scale: 1.28 }] },
  '70%': { transform: [{ scale: 0.94 }] },
  '100%': { transform: [{ scale: 1 }] },
};
export const PIN_POP_MS = 320;

const ICON_MOTION: Partial<Record<IdleMotion, object>> = {
  spin: { animationName: spin, ...loop(9000, 'linear') },
  bounce: { animationName: bounce, ...loop(1400) },
  bob: { animationName: bob, ...loop(2600) },
  pulse: { animationName: pulse, ...loop(2200) },
  float: { animationName: float, ...loop(3000) },
};

function Extras({ motion }: { motion: IdleMotion }) {
  if (motion === 'steam') {
    return (
      <>
        <Animated.View style={[styles.steam, { left: BADGE / 2 - 7 }, { animationName: steam, ...loop(2200) }]} />
        <Animated.View style={[styles.steam, { left: BADGE / 2 + 3 }, { animationName: steam, ...loop(2200), animationDelay: 900 }]} />
      </>
    );
  }
  if (motion === 'flicker') {
    return (
      <>
        <Animated.View style={[styles.flame, { left: BADGE / 2 - 9, backgroundColor: '#ff7a2b' }, { animationName: flicker, ...loop(700) }]} />
        <Animated.View style={[styles.flame, { left: BADGE / 2 + 1, height: 9, backgroundColor: '#ffd27a' }, { animationName: flicker, ...loop(520), animationDelay: 200 }]} />
      </>
    );
  }
  return null;
}

type RestaurantPinProps = {
  restaurant: MapRestaurant;
  /** Run the idle and glow animations. Off for locked pins, off-screen pins and Reduce Motion. */
  animate: boolean;
  /** Play the tap pop once. */
  popping: boolean;
};

export const RestaurantPin = memo(function RestaurantPin({ restaurant, animate, popping }: RestaurantPinProps) {
  const look = pinLook(restaurant.card?.stage ?? null);
  const motion = idleMotion(restaurant.icon);
  return (
    <View style={styles.box}>
      <Animated.View style={[styles.pin, { opacity: look.opacity }, popping ? { animationName: pop, animationDuration: PIN_POP_MS, animationTimingFunction: cubicBezier(0.3, 1.4, 0.5, 1) } : null]}>
        {look.glow ? (
          <Animated.View style={[styles.glow, { boxShadow: `0 0 14px ${look.glow}, 0 0 4px ${look.glow}`, borderColor: look.glow }, animate ? { animationName: glowPulse, ...loop(2400) } : null]} />
        ) : null}
        <View style={[styles.pointer, { borderTopColor: look.ring }]} />
        <View style={[styles.badge, { backgroundColor: look.fill, borderColor: look.ring }]}>
          <Animated.View style={animate ? ICON_MOTION[motion] : null}>
            <CuisineIcon kind={restaurant.icon} size={ICON} color={look.ink} cutout={look.fill} />
          </Animated.View>
          {animate ? <Extras motion={motion} /> : null}
        </View>
        {look.locked ? (
          <View style={styles.lock}>
            <View style={styles.shackle} />
            <View style={styles.lockBody} />
          </View>
        ) : null}
        {look.sparkle ? <Animated.View style={[styles.sparkle, animate ? { animationName: sparkle, ...loop(2800) } : null]} /> : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Larger than the badge so the glow is not clipped by the marker's bounds.
  box: { width: PIN_BOX.width, height: PIN_BOX.height, alignItems: 'center', justifyContent: 'flex-end' },
  pin: { width: BADGE, height: BADGE + 8, marginBottom: 6 },
  badge: { position: 'absolute', left: 0, top: 0, width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', left: 0, top: 0, width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 1 },
  pointer: { position: 'absolute', left: BADGE / 2 - 7, top: BADGE - 4, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  steam: { position: 'absolute', top: 5, width: 4, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)', opacity: 0 },
  flame: { position: 'absolute', top: 3, width: 8, height: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, transformOrigin: '50% 100%' },
  lock: { position: 'absolute', right: -4, top: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a130d', borderWidth: 1.5, borderColor: '#f2b632', alignItems: 'center', justifyContent: 'center' },
  shackle: { width: 7, height: 5, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#f2b632' },
  lockBody: { width: 10, height: 7, borderRadius: 1.5, backgroundColor: '#f2b632' },
  sparkle: { position: 'absolute', right: -2, top: -2, width: 9, height: 9, borderRadius: 1.5, backgroundColor: '#fff6d6', transform: [{ rotate: '45deg' }], boxShadow: '0 0 6px #f5c542' },
});
