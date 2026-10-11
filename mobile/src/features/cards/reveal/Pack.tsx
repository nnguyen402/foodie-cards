import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { gradient } from '../gradient';
import { PACK_TOP_SHARE, crackSegments, shardSpecs, shredSpecs, type Shard, type Shred } from './packGeometry';

// The sealed foil pack, drawn in code: ketchup-to-mustard foil, a tear strip on
// top, crack lines for the Ultra Rare heartbeat, and the debris of opening it.

const FOIL = 'linear-gradient(160deg, #e2462f 0%, #b5291c 48%, #f2b632 49%, #e89f1d 100%)';
const FOIL_TOP = 'linear-gradient(160deg, #e2462f 0%, #c43421 100%)';
const SHEEN = 'linear-gradient(115deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.18) 37%, rgba(255,255,255,0) 46%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0) 78%)';
const SHADOW = '0 18px 30px rgba(0,0,0,0.6)';
const CRACK = '#fff6d6';
const GOLD = '#f5c542';
const RADIUS = 6;
const PERFORATIONS = 14;

const tearOff = {
  from: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }], opacity: 1 },
  to: { transform: [{ translateX: 90 }, { translateY: -120 }, { rotate: '34deg' }], opacity: 0 },
};
const crackIn = { from: { opacity: 0 }, to: { opacity: 1 } };

type PackProps = {
  width: number;
  height: number;
  /** Colour the pack glows once it is charged, or null. */
  glow: string | null;
  torn: boolean;
  tearMs: number;
  /** Highest crack wave showing, -1 for none. */
  crackWave: number;
};

export const Pack = memo(function Pack({ width, height, glow, torn, tearMs, crackWave }: PackProps) {
  const topHeight = height * PACK_TOP_SHARE;
  const segments = useMemo(() => crackSegments(width, height), [width, height]);
  return (
    <View accessible={false} style={{ width, height }}>
      <View style={[styles.body, { top: height * 0.125, boxShadow: glow ? `${SHADOW}, 0 0 26px ${glow}` : SHADOW }, gradient(FOIL, '#b5291c')]}>
        <View style={[StyleSheet.absoluteFill, gradient(SHEEN, 'transparent')]} />
        <Text allowFontScaling={false} style={[styles.logo, { fontSize: width * 0.15, lineHeight: width * 0.15 }]}>FOODIE</Text>
        <Text allowFontScaling={false} style={[styles.logo, { fontSize: width * 0.15, lineHeight: width * 0.15 }]}>CARDS</Text>
        <View style={styles.tag}>
          <Text allowFontScaling={false} style={styles.tagText}>ATLANTA SET</Text>
        </View>
      </View>
      <Animated.View
        style={[styles.top, { height: topHeight }, gradient(FOIL_TOP, '#c43421'),
          torn ? { animationName: tearOff, animationDuration: tearMs, animationFillMode: 'forwards', animationTimingFunction: cubicBezier(0.3, 0.7, 0.4, 1) } : null]}
      >
        <View style={[styles.perforation, { bottom: topHeight * 0.18 }]}>
          {Array.from({ length: PERFORATIONS }, (_, index) => <View key={`perforation-${index}`} style={styles.dash} />)}
        </View>
      </Animated.View>
      {segments.map((segment) => (segment.wave > crackWave ? null : (
        <Animated.View
          key={segment.key}
          style={{
            position: 'absolute', left: segment.cx - segment.length / 2, top: segment.cy - 1, width: segment.length, height: 2, borderRadius: 1,
            backgroundColor: CRACK, boxShadow: `0 0 5px ${GOLD}`, transform: [{ rotate: `${segment.angleDeg}deg` }],
            animationName: crackIn, animationDuration: 380, animationFillMode: 'both',
          }}
        />
      )))}
    </View>
  );
});

const shredKeyframes = (shred: Shred) => ({
  from: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }], opacity: 1 },
  to: { transform: [{ translateX: shred.dx }, { translateY: shred.dy }, { rotate: `${shred.rotateDeg}deg` as const }], opacity: 0 },
});

function ShredView({ shred }: { shred: Shred }) {
  const keyframes = useMemo(() => shredKeyframes(shred), [shred]);
  return (
    <Animated.View style={[styles.shred, { left: shred.x - 5 }, gradient('linear-gradient(90deg, #d8402b, #f2b632)', '#d8402b'), {
      animationName: keyframes, animationDuration: shred.durationMs, animationFillMode: 'forwards', animationTimingFunction: cubicBezier(0.2, 0.7, 0.4, 1),
    }]} />
  );
}

/** Paper bits flying off the top edge as the pack tears. Place at the pack's top-left corner. */
export const Shreds = memo(function Shreds({ packWidth }: { packWidth: number }) {
  const shreds = useMemo(() => shredSpecs(packWidth), [packWidth]);
  return <>{shreds.map((shred) => <ShredView key={shred.key} shred={shred} />)}</>;
});

const shardKeyframes = (shard: Shard) => ({
  from: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }], opacity: 1 },
  to: { transform: [{ translateX: shard.dx }, { translateY: shard.dy }, { rotate: `${shard.rotateDeg}deg` as const }, { scale: 0.6 }], opacity: 0 },
});

function ShardView({ shard, rows }: { shard: Shard; rows: number }) {
  const keyframes = useMemo(() => shardKeyframes(shard), [shard]);
  const red = shard.row < rows / 2;
  return (
    <Animated.View style={[{ position: 'absolute', left: shard.x, top: shard.y, width: shard.width, height: shard.height, borderRadius: 3 },
      gradient(red ? 'linear-gradient(160deg, #e2462f, #b5291c)' : 'linear-gradient(160deg, #f2b632, #e89f1d)', red ? '#b5291c' : '#e89f1d'), {
        animationName: keyframes, animationDuration: shard.durationMs, animationFillMode: 'forwards', animationTimingFunction: cubicBezier(0.12, 0.8, 0.3, 1),
      }]} />
  );
}

const SHARD_ROWS = 4;

/** The pack blown into pieces. Place at the pack's top-left corner. */
export const Shards = memo(function Shards({ width, height }: { width: number; height: number }) {
  const shards = useMemo(() => shardSpecs(width, height, 4, SHARD_ROWS), [width, height]);
  return <>{shards.map((shard) => <ShardView key={shard.key} shard={shard} rows={SHARD_ROWS} />)}</>;
});

const styles = StyleSheet.create({
  body: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: RADIUS, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  perforation: { position: 'absolute', left: '4%', right: '4%', flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 8, height: 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  logo: { color: '#ffffff', fontWeight: '900', letterSpacing: 1, textShadowColor: '#7a1a10', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  tag: { marginTop: 8, backgroundColor: '#f2b632', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { color: '#2a1708', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  shred: { position: 'absolute', top: 0, width: 10, height: 6, borderRadius: 1 },
});
