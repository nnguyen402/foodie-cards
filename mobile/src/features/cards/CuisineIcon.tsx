import { View, type ViewStyle } from 'react-native';
import type { CuisineIconKind } from './themes';

// Simple food icons drawn with plain views on a 100-unit grid. `color` is the ink;
// `cutout` is the colour behind the icon, used for details punched out of a shape.

type Part = ViewStyle & { x: number; y: number; w: number; h: number; r?: number; fill?: 'ink' | 'cutout' };

function part(u: number, color: string, cutout: string, { x, y, w, h, r = 0, fill = 'ink', ...style }: Part): ViewStyle {
  return { position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, borderRadius: r * u, backgroundColor: fill === 'ink' ? color : cutout, ...style };
}

const icons: Record<Exclude<CuisineIconKind, 'pizza'>, (u: number) => Part[]> = {
  coffee: (u) => [
    { x: 32, y: 10, w: 6, h: 18, r: 3 },
    { x: 48, y: 10, w: 6, h: 18, r: 3 },
    { x: 58, y: 42, w: 26, h: 26, r: 13, backgroundColor: 'transparent', borderWidth: 6 * u },
    { x: 18, y: 36, w: 50, h: 42, r: 4, borderBottomLeftRadius: 20 * u, borderBottomRightRadius: 20 * u },
    { x: 10, y: 84, w: 66, h: 6, r: 3 },
  ],
  bbq: (u) => [
    { x: 44, y: 8, w: 12, h: 7, r: 3 },
    { x: 18, y: 14, w: 64, h: 28, r: 2, borderTopLeftRadius: 32 * u, borderTopRightRadius: 32 * u },
    { x: 18, y: 46, w: 64, h: 28, r: 2, borderBottomLeftRadius: 32 * u, borderBottomRightRadius: 32 * u },
    { x: 30, y: 68, w: 6, h: 26, r: 3, transform: [{ rotate: '18deg' }] },
    { x: 64, y: 68, w: 6, h: 26, r: 3, transform: [{ rotate: '-18deg' }] },
  ],
  // A fried chicken drumstick, built upright and tilted as one piece.
  southern: () => [
    { x: 27, y: 4, w: 46, h: 58, r: 23 },
    { x: 45, y: 54, w: 10, h: 30, r: 2 },
    { x: 36, y: 80, w: 15, h: 15, r: 8 },
    { x: 49, y: 80, w: 15, h: 15, r: 8 },
  ],
  burger: (u) => [
    { x: 14, y: 16, w: 72, h: 30, r: 5, borderTopLeftRadius: 30 * u, borderTopRightRadius: 30 * u },
    { x: 32, y: 26, w: 7, h: 4, r: 2, fill: 'cutout' },
    { x: 47, y: 21, w: 7, h: 4, r: 2, fill: 'cutout' },
    { x: 61, y: 28, w: 7, h: 4, r: 2, fill: 'cutout' },
    { x: 9, y: 51, w: 82, h: 6, r: 3 },
    { x: 14, y: 62, w: 72, h: 11, r: 5 },
    { x: 14, y: 78, w: 72, h: 12, r: 3, borderBottomLeftRadius: 10 * u, borderBottomRightRadius: 10 * u },
  ],
  // Two maki rolls side by side, seen from above, with chopsticks across the top.
  sushi: (u) => [
    { x: 8, y: 14, w: 84, h: 5, r: 3, transform: [{ rotate: '-6deg' }] },
    { x: 8, y: 26, w: 84, h: 5, r: 3, transform: [{ rotate: '-6deg' }] },
    { x: 8, y: 44, w: 40, h: 40, r: 20 },
    { x: 18, y: 54, w: 20, h: 20, r: 10, fill: 'cutout' },
    { x: 24, y: 60, w: 8, h: 8, r: 4 },
    { x: 52, y: 44, w: 40, h: 40, r: 20 },
    { x: 62, y: 54, w: 20, h: 20, r: 10, fill: 'cutout' },
    { x: 68, y: 60, w: 8, h: 8, r: 4 },
  ],
  plate: (u) => [
    { x: 24, y: 24, w: 52, h: 52, r: 26, backgroundColor: 'transparent', borderWidth: 6 * u },
    { x: 38, y: 38, w: 24, h: 24, r: 12 },
    { x: 8, y: 20, w: 6, h: 60, r: 3 },
    { x: 86, y: 20, w: 6, h: 60, r: 3 },
  ],
};

export function CuisineIcon({ kind, size, color, cutout }: { kind: CuisineIconKind; size: number; color: string; cutout: string }) {
  const u = size / 100;
  if (kind === 'pizza') {
    return (
      <View style={{ width: size, height: size }}>
        <View style={part(u, color, cutout, { x: 14, y: 10, w: 72, h: 14, r: 7 })} />
        {/* A zero-size view whose top border forms the slice. */}
        <View style={{ position: 'absolute', left: 20 * u, top: 28 * u, width: 0, height: 0, borderLeftWidth: 30 * u, borderRightWidth: 30 * u, borderTopWidth: 64 * u, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
        <View style={part(u, color, cutout, { x: 34, y: 34, w: 12, h: 12, r: 6, fill: 'cutout' })} />
        <View style={part(u, color, cutout, { x: 53, y: 40, w: 10, h: 10, r: 5, fill: 'cutout' })} />
        <View style={part(u, color, cutout, { x: 45, y: 58, w: 9, h: 9, r: 5, fill: 'cutout' })} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, transform: kind === 'southern' ? [{ rotate: '38deg' }] : undefined }}>
      {icons[kind](u).map((shape, index) => <View key={index} style={part(u, color, cutout, shape)} />)}
    </View>
  );
}
