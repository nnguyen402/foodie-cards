import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/reusables/text';
import { CuisineIcon } from '../cards/CuisineIcon';
import { stageLabel } from '../cards/stageStyles';
import { readableTextOn } from '../cards/themes';
import { categoryLabel } from './labels';
import type { MapRestaurant } from './mapRestaurants';
import { pinLook } from './pinStyle';

// The preview that slides up when a token is tapped: a dark card above the tab bar.
// Tapping the card itself opens the full card popup.
const TAB_BAR_CLEARANCE = 64;
const INK = '#f6ede2';
const INK_MUTED = '#b5a594';
const GOLD = '#f2b632';
const slideUp = { from: { opacity: 0, transform: [{ translateY: 40 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };

type RestaurantSheetProps = {
  restaurant: MapRestaurant;
  distance: string | null;
  onOpenCard: () => void;
  onScan: () => void;
  onViewCard: (cardId: string) => void;
  onClose: () => void;
};

export function RestaurantSheet({ restaurant, distance, onOpenCard, onScan, onViewCard, onClose }: RestaurantSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { card, theme } = restaurant;
  const look = pinLook(card?.stage ?? null);
  const details = [categoryLabel(restaurant.category), restaurant.neighbourhood, distance].filter(Boolean).join(' · ');

  return (
    <Animated.View
      // Remounts per restaurant so the slide plays again when another token is tapped.
      key={restaurant.id}
      className="absolute left-3 right-3 gap-3 rounded-3xl p-3.5"
      style={[{ bottom: insets.bottom + TAB_BAR_CLEARANCE, backgroundColor: 'rgba(18,14,11,0.95)', borderWidth: 1, borderColor: 'rgba(242,182,50,0.4)', boxShadow: '0 10px 24px rgba(0,0,0,0.5)' },
        reducedMotion ? null : { animationName: slideUp, animationDuration: 260, animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1), animationFillMode: 'both' }]}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${restaurant.name}. ${details}. ${card ? `${stageLabel(card.stage)} card` : 'Not collected yet'}. Opens the card.`}
          onPress={onOpenCard}
          className="flex-1 flex-row items-center gap-3 active:opacity-80"
        >
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: theme.primaryColor, borderWidth: 2, borderColor: look.ring }}>
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: theme.accentColor }}>
              <CuisineIcon kind={restaurant.icon} size={30} color={readableTextOn(theme.accentColor)} cutout={theme.accentColor} />
            </View>
          </View>
          <View className="flex-1 gap-1">
            <Text numberOfLines={1} className="text-lg font-extrabold" style={{ color: INK }}>{restaurant.name}</Text>
            <Text numberOfLines={1} className="text-sm font-medium" style={{ color: INK_MUTED }}>{details}</Text>
            <View className="self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: look.fill, borderWidth: 1.5, borderColor: look.ring }}>
              <Text className="text-xs font-bold" style={{ color: look.ink }}>{card ? stageLabel(card.stage) : 'Not collected'}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" style={{ backgroundColor: 'rgba(246,237,226,0.12)' }}>
          <Text allowFontScaling={false} className="text-lg font-bold" style={{ color: INK }}>×</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={card ? `View your ${restaurant.name} card` : `Scan a receipt from ${restaurant.name} to unlock its card`}
        onPress={() => (card ? onViewCard(card.id) : onScan())}
        className="min-h-14 items-center justify-center rounded-2xl px-4 active:opacity-80"
        style={{ backgroundColor: GOLD }}
      >
        <Text className="text-base font-extrabold" style={{ color: '#1b130b' }}>{card ? 'View card' : 'Scan receipt to unlock'}</Text>
      </Pressable>
    </Animated.View>
  );
}
