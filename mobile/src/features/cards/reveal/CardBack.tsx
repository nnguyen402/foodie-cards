import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { frameRects } from '../frameLayout';
import { gradient } from '../gradient';

// The sealed card: dark, gold-edged and the same shape as the card frame.
// The user picked this over the reference's red back.
const GOLD = '#f2b632';
const BORDER = 6;
const COLUMNS = 5;
const ROWS = 7;

export function CardBack({ width }: { width: number }) {
  const rects = useMemo(() => frameRects(width), [width]);
  const inner = { width: width - BORDER * 2, height: rects.height - BORDER * 2 };
  const cell = inner.width / COLUMNS;
  const diamonds = useMemo(() => {
    const size = cell * 0.52;
    const rowStep = inner.height / ROWS;
    return Array.from({ length: (ROWS + 1) * (COLUMNS + 1) }, (_, index) => {
      const row = Math.floor(index / (COLUMNS + 1));
      const column = index % (COLUMNS + 1);
      // Alternate rows sit half a cell over, so the squares tile as a lattice.
      const x = column * cell + (row % 2 ? 0 : cell / 2) - cell / 2;
      return { key: index, left: x + cell / 2 - size / 2, top: row * rowStep - size / 2, size };
    });
  }, [cell, inner.height]);
  const fontSize = width * 0.13;

  return (
    <View
      accessible={false}
      style={[{ width, height: rects.height, borderRadius: rects.radius, borderWidth: BORDER, borderColor: GOLD, overflow: 'hidden' }, gradient('linear-gradient(160deg, #241a11 0%, #1a130d 55%, #120d08 100%)', '#1a130d')]}
    >
      {diamonds.map(({ key, ...box }) => (
        <View key={key} style={{ position: 'absolute', left: box.left, top: box.top, width: box.size, height: box.size, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(242,182,50,0.22)', transform: [{ rotate: '45deg' }] }} />
      ))}
      <View style={{ position: 'absolute', left: 10, top: 10, right: 10, bottom: 10, borderRadius: Math.max(0, rects.radius - BORDER - 4), borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(242,182,50,0.55)' }} />
      <View style={styles.centre}>
        <View style={[styles.plate, { borderRadius: width * 0.06, paddingHorizontal: width * 0.08, paddingVertical: width * 0.05 }]}>
          <Text allowFontScaling={false} style={[styles.word, { fontSize }]}>FOODIE</Text>
          <Text allowFontScaling={false} style={[styles.word, { fontSize }]}>CARDS</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  plate: { backgroundColor: '#1a130d', borderWidth: 2, borderColor: GOLD, alignItems: 'center' },
  word: { color: GOLD, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
});
