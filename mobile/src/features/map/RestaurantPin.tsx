import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { CuisineIcon } from '../cards/CuisineIcon';
import { cuisineColors, getCuisineArt } from '../cards/cuisineArt';
import type { MapRestaurant } from './mapRestaurants';
import { idleMotion, type IdleMotion } from './pinMotion';
import { pinLook } from './pinStyle';

// One map token, drawn in code: a big round badge with a thick ring in its cuisine colour and
// the cuisine art or icon inside, a crown above it at the top stage, and a dark name pill below.
// Locked tokens keep their cuisine colours, dimmed, with a lock badge, and stay still;
// collected ones glow in their stage colour and, when `animate` is set, run the idle motion.

const BADGE = 64;
const ICON = 36;
const RING = 5;
const GLOW_ROOM = 14;
const CROWN_HEIGHT = 16;
const LABEL_GAP = 5;
const LABEL_HEIGHT = 38;
export const PIN_BOX = { width: 156, height: GLOW_ROOM + CROWN_HEIGHT + BADGE + LABEL_GAP + LABEL_HEIGHT };
/** How far below the box's centre the badge's centre sits, for placing the badge on the coordinate. */
export const PIN_CENTRE_OFFSET = PIN_BOX.height / 2 - (GLOW_ROOM + CROWN_HEIGHT + BADGE / 2);
const CROWN = '#f5c542';

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
        <Animated.View style={[styles.steam, { left: BADGE / 2 - 8 - RING }, { animationName: steam, ...loop(2200) }]} />
        <Animated.View style={[styles.steam, { left: BADGE / 2 + 4 - RING }, { animationName: steam, ...loop(2200), animationDelay: 900 }]} />
      </>
    );
  }
  if (motion === 'flicker') {
    return (
      <>
        <Animated.View style={[styles.flame, { left: BADGE / 2 - 9 - RING, backgroundColor: '#ff7a2b' }, { animationName: flicker, ...loop(700) }]} />
        <Animated.View style={[styles.flame, { left: BADGE / 2 + 1 - RING, height: 9, backgroundColor: '#ffd27a' }, { animationName: flicker, ...loop(520), animationDelay: 200 }]} />
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
  /** "0.8 mi" from the player, or null when there is no real player position. */
  distance: string | null;
};

function Crown() {
  return (
    <View style={styles.crown}>
      <View style={styles.crownPoints}>
        {[10, 14, 10].map((height, index) => <View key={`point-${index}`} style={[styles.crownPoint, { borderBottomWidth: height }]} />)}
      </View>
      <View style={styles.crownBand} />
    </View>
  );
}

export const RestaurantPin = memo(function RestaurantPin({ restaurant, animate, popping, distance }: RestaurantPinProps) {
  const look = pinLook(restaurant.card?.stage ?? null);
  const motion = idleMotion(restaurant.icon);
  const colors = cuisineColors(restaurant.cuisine);
  const art = getCuisineArt(restaurant.cuisine);
  return (
    <View style={[styles.box, { opacity: look.opacity }]}>
      {look.sparkle ? <Crown /> : <View style={styles.crown} />}
      <Animated.View style={[styles.pin, popping ? { animationName: pop, animationDuration: PIN_POP_MS, animationTimingFunction: cubicBezier(0.3, 1.4, 0.5, 1) } : null]}>
        {look.glow ? (
          <Animated.View style={[styles.glow, { boxShadow: `0 0 18px ${look.glow}, 0 0 6px ${look.glow}`, borderColor: look.glow }, animate ? { animationName: glowPulse, ...loop(2400) } : null]} />
        ) : null}
        <View style={[styles.badge, { backgroundColor: colors.fill, borderColor: colors.ring }]}>
          <Animated.View style={animate ? ICON_MOTION[motion] : null}>
            {art ? (
              <Image source={art} resizeMode="contain" style={{ width: ICON + 6, height: ICON + 6 }} accessibilityIgnoresInvertColors />
            ) : (
              <CuisineIcon kind={restaurant.icon} size={ICON} color={colors.ink} cutout={colors.fill} />
            )}
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
      <View style={styles.label}>
        <Text numberOfLines={1} allowFontScaling={false} style={styles.name}>{restaurant.name}</Text>
        {distance ? <Text numberOfLines={1} allowFontScaling={false} style={styles.distance}>{distance}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Larger than the badge so the glow and the label are not clipped by the marker's bounds.
  box: { width: PIN_BOX.width, height: PIN_BOX.height, alignItems: 'center', paddingTop: GLOW_ROOM },
  crown: { height: CROWN_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },
  crownPoints: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  crownPoint: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: CROWN },
  crownBand: { width: 32, height: 4, borderRadius: 1, backgroundColor: CROWN, marginBottom: 1 },
  pin: { width: BADGE, height: BADGE },
  badge: { position: 'absolute', left: 0, top: 0, width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: RING, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.45)' },
  glow: { position: 'absolute', left: 0, top: 0, width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 1 },
  steam: { position: 'absolute', top: 6, width: 4, height: 11, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)', opacity: 0 },
  flame: { position: 'absolute', top: 4, width: 8, height: 13, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, transformOrigin: '50% 100%' },
  lock: { position: 'absolute', right: -3, top: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#1a130d', borderWidth: 1.5, borderColor: '#f2b632', alignItems: 'center', justifyContent: 'center' },
  shackle: { width: 7, height: 5, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#f6ede2' },
  lockBody: { width: 10, height: 7, borderRadius: 1.5, backgroundColor: '#f6ede2' },
  sparkle: { position: 'absolute', right: 0, top: 0, width: 9, height: 9, borderRadius: 1.5, backgroundColor: '#fff6d6', transform: [{ rotate: '45deg' }], boxShadow: '0 0 6px #f5c542' },
  label: { marginTop: LABEL_GAP, maxWidth: PIN_BOX.width, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(18,14,11,0.9)', borderWidth: 1, borderColor: 'rgba(246,237,226,0.14)', alignItems: 'center' },
  name: { color: '#f6ede2', fontSize: 12, fontWeight: '700' },
  distance: { color: '#f2b632', fontSize: 11, fontWeight: '700' },
});
