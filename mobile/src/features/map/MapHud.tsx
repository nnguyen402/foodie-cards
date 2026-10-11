import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/reusables/text';
import { useAuth } from '@/providers/auth-provider';
import { hudProgress } from './hud';

// Level, XP bar and discovery count, floating over the map. The map is always dark,
// so this is a fixed dark glass panel rather than a themed surface.
const INK = '#f6ede2';
const INK_MUTED = '#b5a594';
const GOLD = '#f2b632';

export function MapHud({ discovered, total }: { discovered: number; total: number }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  if (!profile) return null;
  const hud = hudProgress(profile, discovered, total);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 16 }}>
      <View
        accessible
        accessibilityLabel={`Level ${hud.level}. ${hud.xpIntoLevel} of ${hud.xpPerLevel} XP to the next level. ${discovered} of ${total} restaurants discovered.`}
        className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
        style={{ backgroundColor: 'rgba(18,14,11,0.82)', borderWidth: 1, borderColor: 'rgba(242,182,50,0.35)' }}
      >
        <View className="items-center justify-center rounded-xl px-3 py-1" style={{ backgroundColor: GOLD }}>
          <Text className="text-xs font-bold" style={{ color: '#1b130b' }}>LVL</Text>
          <Text className="text-xl font-extrabold" style={{ color: '#1b130b' }}>{hud.level}</Text>
        </View>
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold" style={{ color: INK }}>{hud.xpLabel}</Text>
            <Text className="text-xs font-medium" style={{ color: INK_MUTED }}>{hud.discoveredLabel}</Text>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: '#2e251c' }}>
            <View className="h-full rounded-full" style={{ width: `${Math.round(hud.fraction * 100)}%`, backgroundColor: GOLD }} />
          </View>
        </View>
      </View>
    </View>
  );
}
