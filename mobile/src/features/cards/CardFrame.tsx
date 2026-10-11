import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { RestaurantStage } from '@foodie-cards/shared';
import { gradient } from './gradient';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { FRAME, frameRects, seededRandom, type FrameRects, type WindowRect } from './frameLayout';

// React Native port of the team's frame generator (gen.html, 750×1050 canvas).
// Every number below is in canvas units and scaled by the card width. The name,
// art and stats windows are left for the card to fill. Colours are the artwork
// itself, so they stay here rather than in the app theme.

const HOLO = 'linear-gradient(158deg, #ff3d6e, #ffd23d, #3dffb1, #3dc2ff, #b43dff, #ff3d6e)';
const GOLD_FOIL = 'linear-gradient(to bottom right, #8a6415 0%, #ffe08a 25%, #c99a2e 50%, #fff1c2 75%, #9c7219 100%)';
const GOLD = '#d9ad45';
const WINDOWS = ['name', 'art', 'stats'] as const;

type Scale = (value: number) => number;
type Line = (value: number) => number;

function useScale(rects: FrameRects): { px: Scale; line: Line } {
  return useMemo(() => ({
    px: (value: number) => value * rects.scale,
    // Strokes thinner than a device pixel would vanish on small grid cards.
    line: (value: number) => Math.max(StyleSheet.hairlineWidth, value * rects.scale),
  }), [rects.scale]);
}

function fill(px: Scale, inset: number, radius: number, extra: ViewStyle): ViewStyle {
  return { position: 'absolute', left: px(inset), top: px(inset), right: px(inset), bottom: px(inset), borderRadius: px(radius), ...extra };
}

// A canvas stroke of `width` centred on a rounded rect inset by `pathInset` with `pathRadius`.
function Ring({ px, line, pathInset, pathRadius, width, color }: { px: Scale; line: Line; pathInset: number; pathRadius: number; width: number; color: string }) {
  return <View style={fill(px, pathInset - width / 2, pathRadius + width / 2, { borderWidth: line(width), borderColor: color })} />;
}

// A canvas stroke around one content window, `inset` outside its edge.
function windowBox(px: Scale, box: WindowRect, outer: number): ViewStyle {
  return {
    position: 'absolute',
    left: box.x - px(outer),
    top: box.y - px(outer),
    width: box.w + px(outer) * 2,
    height: box.h + px(outer) * 2,
    borderRadius: box.r + px(outer),
  };
}

function WindowRings({ rects, px, line, inset, width, color }: { rects: FrameRects; px: Scale; line: Line; inset: number; width: number; color: string }) {
  return WINDOWS.map((key) => (
    <View key={key} style={[windowBox(px, rects[key], inset + width / 2), { borderWidth: line(width), borderColor: color }]} />
  ));
}

function Badge({ rects, px, line, fillColor, stroke, symbol, symbolColor, glow }: { rects: FrameRects; px: Scale; line: Line; fillColor: string; stroke: string; symbol: string; symbolColor: string; glow?: string }) {
  const { x, y, r } = rects.badge;
  return (
    <View style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r,
      backgroundColor: fillColor, borderWidth: line(4), borderColor: stroke, alignItems: 'center', justifyContent: 'center',
      boxShadow: glow ? `0 0 ${px(18)}px ${glow}` : undefined,
    }}>
      {/* Part of the drawn artwork, so it scales with the card instead of the text-size setting. */}
      <Text allowFontScaling={false} style={{ color: symbolColor, fontSize: px(symbol.length > 1 ? 18 : 26), fontWeight: '700', lineHeight: px(30) }}>{symbol}</Text>
    </View>
  );
}

// Four-point glint, as two crossed bars.
function Sparkle({ px, x, y, size, color, glow }: { px: Scale; x: number; y: number; size: number; color: string; glow: string }) {
  return (
    <View style={{ position: 'absolute', left: px(x - size), top: px(y - size), width: px(size * 2), height: px(size * 2), alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: px(size * 2), height: px(size * 0.36), borderRadius: px(size), backgroundColor: color, boxShadow: `0 0 ${px(12)}px ${glow}` }} />
      <View style={{ position: 'absolute', width: px(size * 0.36), height: px(size * 2), borderRadius: px(size), backgroundColor: color }} />
    </View>
  );
}

function CommonFrame({ rects }: { rects: FrameRects }) {
  const { px, line } = useScale(rects);
  return (
    <>
      <View style={fill(px, 0, 40, gradient('linear-gradient(to bottom right, #f1f3f6, #c7ccd3)', '#dcdfe4'))} />
      <Ring px={px} line={line} pathInset={4} pathRadius={36} width={8} color="#8b9099" />
      <Ring px={px} line={line} pathInset={16} pathRadius={26} width={2} color="#ffffff" />
      <WindowRings rects={rects} px={px} line={line} inset={3} width={6} color="#6b717b" />
      <WindowRings rects={rects} px={px} line={line} inset={8} width={2} color="rgba(255,255,255,0.9)" />
      <Badge rects={rects} px={px} line={line} fillColor="#ffffff" stroke="#6b717b" symbol="●" symbolColor="#3a3f47" />
    </>
  );
}

const RARE_CORNERS = [
  { left: 24, top: 24, flipX: 1, flipY: 1 },
  { left: FRAME.width - 80, top: 24, flipX: -1, flipY: 1 },
  { left: 24, top: FRAME.height - 80, flipX: 1, flipY: -1 },
  { left: FRAME.width - 80, top: FRAME.height - 80, flipX: -1, flipY: -1 },
] as const;

function rareSparkles() {
  const next = seededRandom(11);
  const { width: W, height: H } = FRAME;
  return Array.from({ length: 9 }, (_, index) => {
    const edges = [[next() * W, 8 + next() * 24], [next() * W, H - 30 + next() * 20], [8 + next() * 24, next() * H], [W - 30 + next() * 20, next() * H]];
    const [x, y] = edges[index % 4];
    return { x, y, size: 6 + next() * 10 };
  });
}

function RareFrame({ rects }: { rects: FrameRects }) {
  const { px, line } = useScale(rects);
  const sparkles = useMemo(rareSparkles, []);
  const filigree = { position: 'absolute', borderColor: '#6b4a0e', borderTopWidth: line(3), borderLeftWidth: line(3) } as const;
  return (
    <>
      <View style={fill(px, 0, 40, gradient('linear-gradient(to bottom right, #7a5410 0%, #f7d774 22%, #b8862b 42%, #ffeaa6 60%, #a8761d 80%, #f2cf6a 100%)', '#d3a845'))} />
      <View style={fill(px, 0, 40, { ...gradient(HOLO, 'transparent'), opacity: 0.35, mixBlendMode: 'overlay' })} />
      <Ring px={px} line={line} pathInset={5} pathRadius={35} width={10} color="#5c3d08" />
      <Ring px={px} line={line} pathInset={14} pathRadius={26} width={3} color="#fff3c4" />
      {RARE_CORNERS.map((corner) => (
        <View key={`${corner.left}-${corner.top}`} style={{ position: 'absolute', left: px(corner.left), top: px(corner.top), width: px(56), height: px(56), transform: [{ scaleX: corner.flipX }, { scaleY: corner.flipY }] }}>
          <View style={[filigree, { left: px(4), top: px(4), width: px(36), height: px(36), borderTopLeftRadius: px(36) }]} />
          <View style={[filigree, { left: px(12), top: px(12), width: px(40), height: px(40), borderTopLeftRadius: px(34) }]} />
          <View style={{ position: 'absolute', left: px(15), top: px(15), width: px(14), height: px(14), borderRadius: px(7), borderWidth: line(3), borderColor: '#6b4a0e' }} />
        </View>
      ))}
      <WindowRings rects={rects} px={px} line={line} inset={3} width={7} color="#6b4a0e" />
      <WindowRings rects={rects} px={px} line={line} inset={9} width={2} color="#ffe9a3" />
      {sparkles.map((sparkle, index) => <Sparkle key={index} px={px} color="rgba(255,255,255,0.95)" glow="#ffffff" {...sparkle} />)}
      <Badge rects={rects} px={px} line={line} fillColor="#fff3c4" stroke="#6b4a0e" symbol="★" symbolColor="#7a5410" glow="#ffd76a" />
    </>
  );
}

const ULTRA_STUDS = [[FRAME.width / 2, 13], [FRAME.width / 2, FRAME.height - 13], [13, FRAME.height / 2], [FRAME.width - 13, FRAME.height / 2]] as const;
const ULTRA_SPECK_INSET = 4;
const ULTRA_GLINTS = [
  { x: 110, y: 1006, size: 9 }, { x: 262, y: 1010, size: 6 }, { x: 420, y: 1004, size: 10 }, { x: 566, y: 1009, size: 7 },
  { x: 31, y: 165, size: 7 }, { x: 719, y: 739, size: 8 },
] as const;
const SHIMMER = 'linear-gradient(110deg, rgba(255,255,255,0) 36%, rgba(255,61,110,0.3) 42%, rgba(255,210,61,0.3) 46%, rgba(61,255,177,0.3) 50%, rgba(61,194,255,0.3) 54%, rgba(180,61,255,0.3) 58%, rgba(255,255,255,0) 64%)';
// One slow pass across the frame, then a rest, so the card glints rather than flashes.
const shimmerSweep = {
  '0%': { transform: [{ translateX: '-65%' }] },
  '55%': { transform: [{ translateX: '-10%' }] },
  '100%': { transform: [{ translateX: '-10%' }] },
} as const;

// Gold and violet specks, placed only where the frame shows around the content windows.
function ultraSpecks(count: number) {
  const next = seededRandom(23);
  const { width: W, height: H } = FRAME;
  const windows = WINDOWS.map((key) => frameRects(W)[key]);
  const specks: { x: number; y: number; radius: number; color: string; glows: boolean }[] = [];
  while (specks.length < count) {
    const x = 8 + next() * (W - 16);
    const y = 8 + next() * (H - 16);
    const radius = 1 + next() * 2.4;
    const alpha = (0.6 + next() * 0.4).toFixed(2);
    const violet = next() < 0.28;
    if (windows.some((box) => x > box.x - 8 && x < box.x + box.w + 8 && y > box.y - 8 && y < box.y + box.h + 8)) continue;
    const color = violet ? `rgba(${Math.floor(190 + next() * 40)},160,255,${alpha})` : `rgba(255,${Math.floor(205 + next() * 50)},${Math.floor(95 + next() * 75)},${alpha})`;
    specks.push({ x, y, radius, color, glows: specks.length % 6 === 0 });
  }
  return specks;
}

function UltraRareFrame({ rects }: { rects: FrameRects }) {
  const { px, line } = useScale(rects);
  const reducedMotion = useReducedMotion();
  const thumbnail = rects.width < 240;
  const speckCount = thumbnail ? 70 : 170;
  const specks = useMemo(() => ultraSpecks(speckCount), [speckCount]);
  const glow = (blur: number) => `0 0 ${px(blur)}px #f5c542`;
  return (
    <>
      <View style={fill(px, 0, 40, { ...gradient(GOLD_FOIL, GOLD), boxShadow: glow(22) })} />
      <View style={fill(px, 4, 36, gradient('linear-gradient(to bottom right, #2a1a66 0%, #0d0726 45%, #3a2390 100%)', '#1a1147'))} />
      <View style={fill(px, 18, 24, gradient(GOLD_FOIL, GOLD))} />
      <View style={fill(px, 22, 20, gradient('linear-gradient(to bottom right, #2a1470 0%, #6a3fe0 28%, #2b1680 52%, #8a52f0 76%, #1c0f55 100%)', '#3b2299'))} />
      <View style={fill(px, ULTRA_SPECK_INSET, 36, { overflow: 'hidden' })}>
        {specks.map((speck, index) => (
          <View key={index} style={{
            position: 'absolute', left: px(speck.x - speck.radius - ULTRA_SPECK_INSET), top: px(speck.y - speck.radius - ULTRA_SPECK_INSET),
            width: line(speck.radius * 2), height: line(speck.radius * 2), borderRadius: px(speck.radius), backgroundColor: speck.color,
            boxShadow: speck.glows ? `0 0 ${px(8)}px ${speck.color}` : undefined,
          }} />
        ))}
      </View>
      <View style={fill(px, 0, 40, { ...gradient(HOLO, 'transparent'), opacity: 0.28, mixBlendMode: 'overlay' })} />
      {[rects.name, rects.art].map((box) => (
        <View key={box.y} style={{ position: 'absolute', left: px(70), right: px(70), top: box.y + box.h + px(6), height: line(2), backgroundColor: 'rgba(255,214,110,0.85)', boxShadow: glow(14) }} />
      ))}
      {WINDOWS.map((key) => (
        <View key={key} style={[windowBox(px, rects[key], 6), { ...gradient(GOLD_FOIL, GOLD), boxShadow: glow(20) }]} />
      ))}
      <WindowRings rects={rects} px={px} line={line} inset={9} width={1.5} color="rgba(255,246,214,0.8)" />
      {ULTRA_GLINTS.map((glint) => <Sparkle key={`${glint.x}-${glint.y}`} px={px} color="#fff1c2" glow="#f5c542" {...glint} />)}
      {ULTRA_STUDS.map(([x, y]) => (
        <View key={`${x}-${y}`} style={{ position: 'absolute', left: px(x - 7), top: px(y - 7), width: px(14), height: px(14), backgroundColor: '#ffe08a', transform: [{ rotate: '45deg' }], boxShadow: glow(12) }} />
      ))}
      {/* Collection thumbnails are seen constantly, so only the large card moves. */}
      {thumbnail || reducedMotion ? null : (
        <View style={fill(px, 0, 40, { overflow: 'hidden' })}>
          <Animated.View style={[styles.shimmer, gradient(SHIMMER, 'transparent'), {
            animationName: shimmerSweep, animationDuration: '6s', animationIterationCount: 'infinite', animationTimingFunction: 'linear',
          }]} />
        </View>
      )}
      <Badge rects={rects} px={px} line={line} fillColor="#0b0a12" stroke="#f5c542" symbol="★★" symbolColor="#f5c542" glow="#f5c542" />
    </>
  );
}

const frames: Record<RestaurantStage, (props: { rects: FrameRects }) => React.ReactNode> = {
  discovered: CommonFrame,
  regular: RareFrame,
  house_favorite: UltraRareFrame,
};

export function CardFrame({ stage, rects }: { stage: RestaurantStage; rects: FrameRects }) {
  const Frame = frames[stage];
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Frame rects={rects} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Four card widths with the rainbow band in the middle, so it starts and ends fully off the card.
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '400%' },
});
