import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/reusables/text';

const INK = '#f6ede2';
const GOLD = '#f2b632';
const FADE_MS = 180;

function SearchGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: color }} />
      <View style={{ position: 'absolute', right: 1, bottom: 3, width: 7, height: 2.5, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

type SearchAreaPillProps = { visible: boolean; searching: boolean; onPress: () => void };

// Floats under the location chip. Stays mounted just long enough to fade out, and only the
// pill itself takes touches, so the map underneath keeps panning.
export function SearchAreaPill({ visible, searching, onPress }: SearchAreaPillProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: reducedMotion ? 0 : FADE_MS, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, reducedMotion, opacity]);

  if (!mounted) return null;
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ opacity, alignSelf: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={searching ? 'Searching this area' : 'Search this area'}
        accessibilityState={{ busy: searching, disabled: searching }}
        disabled={searching}
        onPress={onPress}
        hitSlop={6}
        className="min-h-11 flex-row items-center gap-2 rounded-full px-4 active:opacity-70"
        style={{ backgroundColor: 'rgba(18,14,11,0.92)', borderWidth: 1.5, borderColor: GOLD }}
      >
        {searching ? <ActivityIndicator size="small" color={GOLD} /> : <SearchGlyph color={GOLD} />}
        <Text className="text-sm font-extrabold" style={{ color: INK }}>{searching ? 'Searching…' : 'Search this area'}</Text>
      </Pressable>
    </Animated.View>
  );
}
