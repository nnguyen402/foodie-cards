import { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/reusables/text';
import { Button } from '@/components/ui/button';
import { RestaurantCard } from '../cards/RestaurantCard';
import { stageLabel } from '../cards/stageStyles';
import type { CardView } from '../cards/types';
import { abilityLine, categoryLabel, flavourLine } from './labels';
import { mapCardAvailability, type MapRestaurant } from './mapRestaurants';

// The full card, shown over the map: our own stage frame with the restaurant's name, a
// flavour line and, for a collected restaurant, its real XP and visits. An uncollected
// restaurant shows the Common frame with no stats.
const INK = '#f6ede2';
const INK_MUTED = '#b5a594';
const GOLD = '#f2b632';
const CARD_MAX_WIDTH = 300;
const popIn = { from: { opacity: 0, transform: [{ scale: 0.92 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } };
const fadeIn = { from: { opacity: 0 }, to: { opacity: 1 } };

type MapCardPopupProps = {
  restaurant: MapRestaurant;
  /** Optional artwork for the art window (a photo or prepared illustration). Without it the cuisine icon is drawn. */
  imageUrl?: string;
  onScan: () => void;
  onViewCard: (cardId: string) => void;
  onClose: () => void;
};

export function MapCardPopup({ restaurant, imageUrl, onScan, onViewCard, onClose }: MapCardPopupProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.floor(Math.max(160, Math.min(CARD_MAX_WIDTH, width - 72, (height - insets.top - insets.bottom - 300) / 1.4)));
  const { card } = restaurant;
  const availability = mapCardAvailability(restaurant);
  // An uncollected restaurant has no card yet, so the frame is filled from the catalog alone.
  const shown = useMemo<CardView>(() => card ?? {
    id: `preview-${restaurant.id}`, stage: 'discovered', cardXP: 0, visitCount: 0, lastVisitDate: null, rating: null,
    restaurant: { id: restaurant.id, name: restaurant.name, locationLabel: restaurant.neighbourhood, category: restaurant.category, theme: restaurant.theme, heroImagePath: null, heroImageKind: null },
  }, [card, restaurant]);

  return (
    <Animated.View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }, reducedMotion ? null : { animationName: fadeIn, animationDuration: 180 }]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Close card" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.content, reducedMotion ? null : { animationName: popIn, animationDuration: 260, animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1), animationFillMode: 'both' }]}>
        <RestaurantCard card={shown} width={cardWidth} uncollected={!card} cuisine={restaurant.cuisine} heroSource={imageUrl ? { uri: imageUrl } : undefined} />
        <View className="items-center gap-1" style={{ maxWidth: cardWidth + 40 }}>
          <Text className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: 1.5 }}>
            {categoryLabel(restaurant.category)} · {card ? stageLabel(card.stage) : 'Not collected yet'}
          </Text>
          <Text className="text-center text-base font-medium italic" style={{ color: INK }}>{flavourLine(restaurant.category)}</Text>
          <Text className="text-center text-sm font-bold" style={{ color: GOLD }}>{abilityLine(restaurant.cuisine)}</Text>
          {availability === 'unavailable' ? (
            <Text className="text-center text-sm font-semibold" style={{ color: INK_MUTED }}>Nearby listing only · a card can’t be created for it from a receipt yet.</Text>
          ) : null}
          {card ? (
            <Text className="text-sm font-semibold" style={{ color: INK_MUTED }}>
              {card.cardXP} XP · {card.visitCount} {card.visitCount === 1 ? 'visit' : 'visits'}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-3" style={{ width: cardWidth + 40 }}>
          {card ? (
            <>
              <View style={styles.half}><Button label="Card details" variant="secondary" onPress={() => onViewCard(card.id)} accessibilityLabel={`View your ${restaurant.name} card details`} /></View>
              <View style={styles.half}><Button label="Log another visit" onPress={onScan} accessibilityLabel={`Log another visit to ${restaurant.name}`} /></View>
            </>
          ) : (
            <>
              <View style={styles.half}><Button label="Close" variant="secondary" onPress={onClose} /></View>
              <View style={styles.half}><Button label="Scan receipt to unlock" onPress={onScan} accessibilityLabel={`Scan a receipt from ${restaurant.name} to unlock its card`} /></View>
            </>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(8,5,12,0.82)', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 16 },
  half: { flex: 1 },
});
