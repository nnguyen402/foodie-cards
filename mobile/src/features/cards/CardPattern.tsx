import { StyleSheet, View } from 'react-native';
import type { RestaurantTheme } from '@foodie-cards/shared';
import { gradient } from './gradient';

// Optional subtle decoration behind the art window. Sizes are in frame canvas units.
const DOT_GAP = 84;
const LINE_GAP = 56;

export function CardPattern({ patternKey, color, width, height, scale }: { patternKey: RestaurantTheme['patternKey']; color: string; width: number; height: number; scale: number }) {
  if (patternKey === 'none') return null;
  if (patternKey === 'paper') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradient('linear-gradient(to bottom right, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%, rgba(0,0,0,0.12))', 'transparent')]} />;
  }
  if (patternKey === 'lines') {
    const gap = LINE_GAP * scale;
    const count = Math.ceil(height / gap);
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}>
        {Array.from({ length: count }, (_, row) => (
          <View key={row} style={{ position: 'absolute', left: 0, right: 0, top: (row + 0.5) * gap, height: Math.max(StyleSheet.hairlineWidth, 6 * scale), backgroundColor: color }} />
        ))}
      </View>
    );
  }
  const gap = DOT_GAP * scale;
  const size = 18 * scale;
  const columns = Math.ceil(width / gap);
  const rows = Math.ceil(height / gap);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.22 }]}>
      {Array.from({ length: rows * columns }, (_, index) => (
        <View key={index} style={{
          position: 'absolute', left: ((index % columns) + 0.5) * gap - size / 2, top: (Math.floor(index / columns) + 0.5) * gap - size / 2,
          width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        }} />
      ))}
    </View>
  );
}
