import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { buildCardDetail, type CardDetail, type DetailReviewRow, type DishRow, type VisitRow } from './detail';
import { shouldStore } from './loadState';
import { CARD_SELECT, type CardRow } from './mapCard';

export type CardDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'ready'; detail: CardDetail };

type Stored = { userId: string; cardId: string; state: CardDetailState };

export function useCardDetail(cardId: string): { state: CardDetailState; refresh: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [stored, setStored] = useState<Stored | null>(null);
  const current = cardId === '' ? { status: 'not-found' as const } : stored?.userId === userId && stored.cardId === cardId ? stored.state : null;
  const latestRequest = useRef(0);
  const keyRef = useRef(`${userId}/${cardId}`);
  keyRef.current = `${userId}/${cardId}`;
  const storedRef = useRef<Stored | null>(null);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    if (!supabase || !userId || !cardId) return;
    const request = ++latestRequest.current;
    const publish = (incoming: CardDetailState) => {
      const previous = storedRef.current?.userId === userId && storedRef.current.cardId === cardId ? storedRef.current.state : null;
      const isLatest = isActive() && request === latestRequest.current && keyRef.current === `${userId}/${cardId}`;
      if (!shouldStore({ isLatest, previous, incoming })) return;
      storedRef.current = { userId, cardId, state: incoming };
      setStored(storedRef.current);
    };
    try {
      const cardResult = await supabase.from('cards').select(CARD_SELECT).eq('id', cardId).eq('user_id', userId).maybeSingle();
      if (cardResult.error) throw cardResult.error;
      const card = cardResult.data as unknown as CardRow | null;
      if (!card?.restaurants) return publish({ status: 'not-found' });
      const [visits, dishes, review] = await Promise.all([
        supabase.from('visits').select('visit_date').eq('card_id', cardId),
        supabase.from('user_items').select('menu_item_id,first_purchase_date,menu_items(canonical_name)').eq('card_id', cardId),
        supabase.from('reviews').select('rating,text').eq('user_id', userId).eq('restaurant_id', card.restaurants.id).maybeSingle(),
      ]);
      const failure = visits.error ?? dishes.error ?? review.error;
      if (failure) throw failure;
      const detail = buildCardDetail(
        card,
        (review.data ?? null) as unknown as DetailReviewRow,
        (visits.data ?? []) as unknown as VisitRow[],
        (dishes.data ?? []) as unknown as DishRow[],
      );
      publish(detail ? { status: 'ready', detail } : { status: 'not-found' });
    } catch (error) {
      publish({ status: 'error', message: error instanceof Error ? error.message : 'This card could not be loaded.' });
    }
  }, [userId, cardId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const refresh = useCallback(() => load(), [load]);

  return { state: current ?? { status: 'loading' }, refresh };
}
