import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/reusables/text';
import { CuisineArt } from '../cards/CuisineArtView';
import { cuisineColors } from '../cards/cuisineArt';
import { stageLabel } from '../cards/stageStyles';
import { readableTextOn } from '../cards/themes';
import { categoryLabel } from './labels';
import { mapCardAvailability, type MapRestaurant } from './mapRestaurants';

// The preview that slides up when a token is tapped: a dark card above the tab bar.
// Tapping the card itself opens the full card popup.
const TAB_BAR_CLEARANCE = 80;
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
  const availability = mapCardAvailability(restaurant);
  const colors = cuisineColors(restaurant.cuisine);
  const details = [categoryLabel(restaurant.category), distance].filter(Boolean).join(' · ');
  const address = [restaurant.address, restaurant.neighbourhood].filter(Boolean).join(', ');

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
          accessibilityLabel={`${restaurant.name}. ${details}. ${address}. ${card ? `${stageLabel(card.stage)} card` : 'Not collected yet'}. Opens the card.`}
          onPress={onOpenCard}
          className="flex-1 flex-row items-center gap-3 active:opacity-80"
        >
          <View className="h-16 w-16 overflow-hidden rounded-2xl" style={{ borderWidth: 2, borderColor: colors.ring }}>
            <CuisineArt cuisine={restaurant.cuisine} variant="thumb" locked={!card} tint={{ background: colors.fill, ink: colors.ink }} />
          </View>
          <View className="flex-1 gap-1">
            <Text numberOfLines={1} className="text-lg font-extrabold" style={{ color: INK }}>{restaurant.name}</Text>
            <Text numberOfLines={1} className="text-sm font-medium" style={{ color: INK_MUTED }}>{details}</Text>
            {address ? <Text numberOfLines={1} className="text-xs font-medium" style={{ color: INK_MUTED }}>{address}</Text> : null}
            <View className="self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: colors.fill, borderWidth: 1.5, borderColor: colors.ring }}>
              <Text className="text-xs font-bold" style={{ color: colors.ink }}>{card ? stageLabel(card.stage) : 'Not collected'}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" style={{ backgroundColor: 'rgba(246,237,226,0.12)' }}>
          <Text allowFontScaling={false} className="text-lg font-bold" style={{ color: INK }}>×</Text>
        </Pressable>
      </View>
      {availability === 'unavailable' ? (
        <Text className="text-sm font-medium" style={{ color: INK }}>Nearby listing only — no card is available for this restaurant.</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={card ? `View your ${restaurant.name} card` : `Scan a receipt from ${restaurant.name} to unlock its card`}
          onPress={() => (card ? onViewCard(card.id) : onScan())}
          className="min-h-14 items-center justify-center rounded-2xl px-4 active:opacity-80"
          style={{ backgroundColor: GOLD }}
        >
          <Text className="text-base font-extrabold" style={{ color: '#1b130b' }}>{card ? 'View card' : 'Scan receipt'}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
