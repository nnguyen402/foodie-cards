import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { buildCollection, RESTAURANT_SELECT, type Collection, type RestaurantRow, type ReviewRow } from './collection';
import { createRequestTracker, shouldStore } from './loadState';
import { CARD_SELECT, type CardRow } from './mapCard';

export type CollectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; collection: Collection };

// Tagged with the user it was fetched for so another account never sees it.
type Stored = { userId: string; state: CollectionState };

export function useCollection(): { state: CollectionState; refreshing: boolean; refreshFailed: boolean; refresh: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [stored, setStored] = useState<Stored | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<{ userId: string; failed: boolean }>({ userId: '', failed: false });
  const current = stored?.userId === userId ? stored.state : null;
  const tracker = useRef(createRequestTracker(userId));
  tracker.current.reset(userId);
  const storedRef = useRef<Stored | null>(null);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    if (!supabase || !userId) return;
    const request = tracker.current.next();
    const publish = (incoming: CollectionState) => {
      const previous = storedRef.current?.userId === userId ? storedRef.current.state : null;
      const isLatest = isActive() && tracker.current.isLatest(request);
      if (isLatest) setFailure({ userId, failed: incoming.status === 'error' && previous?.status === 'ready' });
      if (!shouldStore({ isLatest, previous, incoming })) return;
      storedRef.current = { userId, state: incoming };
      setStored(storedRef.current);
    };
    try {
      const [restaurants, cards, reviews] = await Promise.all([
        supabase.from('restaurants').select(RESTAURANT_SELECT),
        supabase.from('cards').select(CARD_SELECT).eq('user_id', userId),
        supabase.from('reviews').select('restaurant_id,rating').eq('user_id', userId),
      ]);
      const failure = restaurants.error ?? cards.error ?? reviews.error;
      if (failure) throw failure;
      const collection = buildCollection(
        (restaurants.data ?? []) as unknown as RestaurantRow[],
        (cards.data ?? []) as unknown as CardRow[],
        (reviews.data ?? []) as unknown as ReviewRow[],
      );
      publish({ status: 'ready', collection });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Your collection could not be loaded.';
      publish({ status: 'error', message });
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const refreshFailed = failure.userId === userId && failure.failed && current?.status === 'ready';
  return { state: current ?? { status: 'loading' }, refreshing, refreshFailed, refresh };
}
