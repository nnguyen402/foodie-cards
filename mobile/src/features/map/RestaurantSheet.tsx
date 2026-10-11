import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { Button } from '@/components/ui/reusables/button';
import { Text } from '@/components/ui/reusables/text';
import { stageLabel } from '../cards/stageStyles';
import type { MapRestaurant } from './mapRestaurants';
import { pinLook } from './pinStyle';

// The panel that slides up when a pin is tapped. Sits above the tab bar.
const TAB_BAR_CLEARANCE = 64;
const slideUp = { from: { opacity: 0, transform: [{ translateY: 40 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };

type RestaurantSheetProps = {
  restaurant: MapRestaurant;
  onScan: () => void;
  onViewCard: (cardId: string) => void;
  onClose: () => void;
};

export function RestaurantSheet({ restaurant, onScan, onViewCard, onClose }: RestaurantSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { card } = restaurant;
  const look = pinLook(card?.stage ?? null);
  const place = [restaurant.neighbourhood, restaurant.address].filter(Boolean).join(' · ');

  return (
    <Animated.View
      // Remounts per restaurant so the slide plays again when another pin is tapped.
      key={restaurant.id}
      accessibilityViewIsModal
      className="absolute left-3 right-3 gap-3 rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/30"
      style={[{ bottom: insets.bottom + TAB_BAR_CLEARANCE },
        reducedMotion ? null : { animationName: slideUp, animationDuration: 260, animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1), animationFillMode: 'both' }]}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text variant="h4" numberOfLines={2}>{restaurant.name}</Text>
          <Text variant="muted">{place}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full bg-secondary active:opacity-70">
          <Text className="text-base font-bold text-secondary-foreground">×</Text>
        </Pressable>
      </View>
      {card ? (
        <View className="flex-row items-center gap-2">
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: look.fill, borderWidth: 1.5, borderColor: look.ring }}>
            <Text className="text-sm font-bold" style={{ color: look.ink }}>{stageLabel(card.stage)}</Text>
          </View>
          <Text variant="muted">In your collection</Text>
        </View>
      ) : (
        <Text>Not collected yet — scan a receipt here to unlock</Text>
      )}
      <View className="flex-row gap-3">
        <Button className="flex-1" onPress={onScan} accessibilityLabel={`Scan a receipt from ${restaurant.name}`}>
          <Text>Scan receipt</Text>
        </Button>
        {card ? (
          <Button className="flex-1" variant="secondary" onPress={() => onViewCard(card.id)} accessibilityLabel={`View your ${restaurant.name} card`}>
            <Text>View card</Text>
          </Button>
        ) : null}
      </View>
    </Animated.View>
  );
}
