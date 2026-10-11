import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/reusables/text';
import { useAuth } from '@/providers/auth-provider';
import { hudProgress } from './hud';
import { SearchAreaPill } from './SearchAreaPill';

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
  /** Returns to the player and searches there. Hidden when there is no real location. */
  onRecenter: (() => void) | null;
  recentering: boolean;
  /** "Search this area": shown once the map has drifted from the discovery circle, and while that search runs. */
  searchPill: { visible: boolean; searching: boolean; onPress: () => void };
  nearby: 'idle' | 'loading' | 'ready' | 'failed';
  onRetryNearby: () => void;
};

function TargetGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

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

export function MapHud({ discovered, total, areaLabel, collectedOnly, onToggleCollectedOnly, onRecenter, recentering, searchPill, nearby, onRetryNearby }: MapHudProps) {
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
        <View className="flex-row items-center gap-2">
        {onRecenter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location and search here"
            accessibilityState={{ busy: recentering, disabled: recentering }}
            disabled={recentering}
            onPress={onRecenter}
            hitSlop={6}
            className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
            style={GLASS}
          >
            {recentering ? <ActivityIndicator color={GOLD} /> : <TargetGlyph color={INK} />}
          </Pressable>
        ) : null}
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
      <SearchAreaPill visible={searchPill.visible} searching={searchPill.searching} onPress={searchPill.onPress} />
      {nearby === 'failed' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Couldn't load nearby restaurants. Retry." onPress={onRetryNearby} className="min-h-11 flex-row items-center self-start rounded-full px-3.5 active:opacity-70" style={[GLASS, { borderColor: 'rgba(223,118,109,0.7)' }]}>
          <Text className="text-xs font-semibold" style={{ color: INK }}>Couldn’t load nearby restaurants — <Text className="text-xs font-extrabold" style={{ color: GOLD }}>retry</Text></Text>
        </Pressable>
      ) : null}
      {nearby === 'loading' && !searchPill.searching ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Finding nearby restaurants" className="flex-row items-center gap-2 self-start rounded-full px-3.5 py-2" style={GLASS}>
          <ActivityIndicator size="small" color={GOLD} />
          <Text className="text-xs font-semibold" style={{ color: INK_MUTED }}>Finding nearby restaurants…</Text>
        </View>
      ) : null}
    </View>
  );
}
