import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { AppText } from '@/components/ui/app-text';
import { MessagePanel } from '@/components/ui/message-panel';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/brand-header';
import { LockedCard } from '@/features/cards/LockedCard';
import { RestaurantCard } from '@/features/cards/RestaurantCard';
import { SortControl } from '@/features/cards/SortControl';
import { sortCards, type CollectionSort } from '@/features/cards/sorting';
import { usePendingReveal } from '@/features/cards/reveal/usePendingReveal';
import { stageLabel } from '@/features/cards/stageStyles';
import { ratingSpoken } from '@/features/cards/themes';
import type { CardView } from '@/features/cards/types';
import { useCollection } from '@/features/cards/useCollection';
import { checkBackendHealth } from '@/lib/api';
import { colors, radius, spacing } from '@/theme/tokens';

const GRID_GAP = spacing.md;
const MAX_CARD_WIDTH = 200;

const motionStyle = {
  transform: [{ scale: 1 }],
  transitionProperty: 'transform',
  transitionDuration: '120ms',
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;
const pressedMotionStyle = { transform: [{ scale: 0.97 }] } as const;

function OwnedCard({ card, width, onOpen }: { card: CardView; width: number; onOpen: () => void }) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.restaurant.name}, ${stageLabel(card.stage)} card, ${ratingSpoken(card.rating)}. Opens card details.`}
      onPress={onOpen}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Animated.View
        // The Pressable carries the label; hide the card's own image element from screen readers.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[motionStyle, pressed && !reducedMotion ? pressedMotionStyle : undefined]}
      >
        <RestaurantCard card={card} width={width} />
      </Animated.View>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { state, refreshing, refreshFailed, refresh } = useCollection();
  const { eventId: pendingEventId } = usePendingReveal();
  const [sort, setSort] = useState<CollectionSort>('recent');
  const [offline, setOffline] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const cardWidth = Math.max(0, Math.min(MAX_CARD_WIDTH, Math.floor((windowWidth - 2 * spacing.page - GRID_GAP) / 2)));

  const checkHealth = useCallback(async () => {
    setOffline(false);
    setHealthError(null);
    try {
      await checkBackendHealth(process.env.EXPO_PUBLIC_API_URL ?? '');
    } catch (error) {
      setOffline(true);
      setHealthError(error instanceof Error ? error.message : 'Backend is not reachable.');
    }
  }, []);

  useEffect(() => { void checkHealth(); }, [checkHealth]);

  const owned = state.status === 'ready' ? state.collection.owned : [];
  const sortedOwned = useMemo(() => sortCards(owned, sort), [owned, sort]);

  let content;
  if (state.status === 'loading') {
    content = <MessagePanel title="Loading your collection" body="Your cards stay private to your account." loading />;
  } else if (state.status === 'error') {
    content = <MessagePanel title="Collection unavailable" body={state.message} kind="error" actionLabel="Try again" onAction={() => void refresh()} />;
  } else {
    const { locked } = state.collection;
    content = (
      <>
        <View style={styles.section}>
          <View style={styles.sectionHeading}><AppText variant="heading" strong>Your cards</AppText><AppText variant="small" muted>{owned.length}</AppText></View>
          {owned.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyStamp}><AppText variant="title" strong style={styles.emptyMark}>01</AppText></View>
              <AppText variant="heading" strong>Your first card starts here.</AppText>
              <AppText muted>When you scan and confirm a restaurant receipt, your first visit will appear in this collection.</AppText>
            </View>
          ) : (
            <>
              {owned.length >= 2 ? <SortControl value={sort} onChange={setSort} /> : null}
              <View style={styles.grid}>
                {cardWidth > 0 ? sortedOwned.map((card) => (
                  <OwnedCard key={card.id} card={card} width={cardWidth} onOpen={() => router.push(`/card/${card.id}`)} />
                )) : null}
              </View>
            </>
          )}
        </View>
        {locked.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}><AppText variant="heading" strong>Still to discover</AppText><AppText variant="small" muted>{locked.length}</AppText></View>
            <View style={styles.grid}>
              {cardWidth > 0 ? locked.map((restaurant) => <LockedCard key={restaurant.id} restaurant={restaurant} width={cardWidth} />) : null}
            </View>
          </View>
        ) : null}
        {__DEV__ ? <Button label="Open card gallery (demo data)" variant="secondary" onPress={() => router.push('/dev/cards')} /> : null}
      </>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <BrandHeader eyebrow="Your food journal" title="Collection" subtitle="Places you’ve made part of your story." />
      {offline ? (
        <View style={styles.health}>
          <View style={styles.healthDot} />
          <View style={styles.healthText}>
            <AppText variant="small" strong>Backend unavailable</AppText>
            <AppText variant="caption" muted>{healthError}</AppText>
          </View>
          <Button label="Retry" variant="quiet" fullWidth={false} onPress={() => void checkHealth()} />
        </View>
      ) : null}
      {pendingEventId ? (
        <View style={styles.reveal}>
          <AppText strong style={styles.revealText}>You have a card to reveal</AppText>
          <Button label="Open" fullWidth={false} onPress={() => router.push(`/reveal/${pendingEventId}`)} />
        </View>
      ) : null}
      {refreshFailed ? <AppText variant="small" style={styles.refreshError} accessibilityRole="alert">Couldn’t refresh. Pull to try again.</AppText> : null}
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  health: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface },
  healthDot: { height: 9, width: 9, borderRadius: 6, backgroundColor: colors.error },
  healthText: { flex: 1, gap: spacing.xs },
  reveal: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.control, backgroundColor: colors.accentSoft },
  revealText: { flex: 1 },
  refreshError: { color: colors.error },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  empty: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  emptyStamp: { height: 52, width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accentSoft },
  emptyMark: { color: colors.accent },
});
