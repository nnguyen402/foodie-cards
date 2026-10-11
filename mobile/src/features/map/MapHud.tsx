import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/reusables/text';
import { useAuth } from '@/providers/auth-provider';
import { hudProgress } from './hud';

// Player bar, location chip and filter button, floating over the map. The map is always
// dark, so these are fixed dark glass panels rather than themed surfaces.
const INK = '#f6ede2';
const INK_MUTED = '#b5a594';
const GOLD = '#f2b632';
const GLASS = { backgroundColor: 'rgba(18,14,11,0.86)', borderWidth: 1, borderColor: 'rgba(242,182,50,0.35)' } as const;

type MapHudProps = {
  discovered: number;
  total: number;
  /** "Atlanta, GA", or the fallback wording. */
  areaLabel: string;
  collectedOnly: boolean;
  onToggleCollectedOnly: () => void;
};

function PinGlyph() {
  return (
    <View style={{ width: 12, height: 16, alignItems: 'center' }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#1b130b' }} />
      </View>
      <View style={{ marginTop: -3, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: GOLD }} />
    </View>
  );
}

function FilterGlyph({ color }: { color: string }) {
  return (
    <View style={{ gap: 4, alignItems: 'center' }}>
      {[18, 12, 6].map((width) => <View key={width} style={{ width, height: 2.5, borderRadius: 2, backgroundColor: color }} />)}
    </View>
  );
}

export function MapHud({ discovered, total, areaLabel, collectedOnly, onToggleCollectedOnly }: MapHudProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const hud = profile ? hudProgress(profile, discovered, total) : null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 16, gap: 10 }}>
      {hud && profile ? (
        <View
          accessible
          accessibilityLabel={`${profile.displayName}, level ${hud.level}. ${hud.xpIntoLevel} of ${hud.xpPerLevel} XP to the next level. ${discovered} of ${total} restaurants discovered.`}
          className="flex-row items-center gap-3 rounded-3xl px-3 py-2.5"
          style={GLASS}
        >
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: GOLD, borderWidth: 2, borderColor: '#fff6d6' }}>
            <Text allowFontScaling={false} className="text-xl font-extrabold" style={{ color: '#1b130b' }}>{profile.displayName.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-base font-extrabold" style={{ color: INK }}>Level {hud.level}</Text>
              <Text className="text-xs font-medium" style={{ color: INK_MUTED }}>{hud.discoveredLabel}</Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: '#2e251c' }}>
              <View className="h-full rounded-full" style={{ width: `${Math.round(hud.fraction * 100)}%`, backgroundColor: GOLD }} />
            </View>
            <Text className="text-xs font-semibold" style={{ color: INK_MUTED }}>{hud.xpLabel}</Text>
          </View>
        </View>
      ) : null}
      <View pointerEvents="box-none" className="flex-row items-center justify-between">
        <View accessible accessibilityLabel={`Showing restaurants within 5 kilometres. ${areaLabel}`} className="flex-row items-center gap-2 rounded-full px-3.5 py-2" style={[GLASS, { flexShrink: 1 }]}>
          <PinGlyph />
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} className="text-sm font-bold" style={{ color: INK }}>{areaLabel}</Text>
            <Text numberOfLines={1} className="text-xs font-medium" style={{ color: INK_MUTED }}>Within 5 km</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: collectedOnly }}
          accessibilityLabel="Show collected restaurants only"
          onPress={onToggleCollectedOnly}
          hitSlop={6}
          className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
          style={collectedOnly ? { backgroundColor: GOLD, borderWidth: 1, borderColor: '#fff6d6' } : GLASS}
        >
          <FilterGlyph color={collectedOnly ? '#1b130b' : INK} />
        </Pressable>
      </View>
    </View>
  );
}
