import { useCallback, useEffect, useRef, useState } from 'react';
import type { RestaurantStage } from '@foodie-cards/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { toRating } from '../collection';
import { fixtureCards } from '../fixtures';
import { createRequestTracker, shouldStore } from '../loadState';
import { CARD_SELECT, toCardView, type CardRow } from '../mapCard';
import type { CardView } from '../types';
import { demoRevealStage, isDemoEventId, isEventId, markRevealHandled, parseRevealPayload } from './revealEvent';

export type RevealEventState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'ready'; card: CardView; previousStage: RestaurantStage | null; demo: boolean };

type Stored = { userId: string; eventId: string; state: RevealEventState };

const STAGE_BELOW: Record<RestaurantStage, RestaurantStage | null> = { discovered: null, regular: 'discovered', house_favorite: 'regular' };

function demoState(eventId: string): RevealEventState {
  const stage = __DEV__ ? demoRevealStage(eventId) : null;
  if (!stage) return { status: 'not-found' };
  return { status: 'ready', card: fixtureCards(stage)[0], previousStage: STAGE_BELOW[stage], demo: true };
}

export function useRevealEvent(eventId: string): { state: RevealEventState; retry: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const key = `${userId}/${eventId}`;
  const [stored, setStored] = useState<Stored | null>(null);
  const tracker = useRef(createRequestTracker(key));
  tracker.current.reset(key);
  const storedRef = useRef<Stored | null>(null);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    if (!supabase || !userId || !eventId || isDemoEventId(eventId)) return;
    const token = tracker.current.next();
    const publish = (incoming: RevealEventState) => {
      const previous = storedRef.current?.userId === userId && storedRef.current.eventId === eventId ? storedRef.current.state : null;
      if (!shouldStore({ isLatest: isActive() && tracker.current.isLatest(token), previous, incoming })) return;
      if (incoming.status === 'not-found') markRevealHandled(eventId);
      storedRef.current = { userId, eventId, state: incoming };
      setStored(storedRef.current);
    };
    if (!isEventId(eventId)) return publish({ status: 'not-found' });
    try {
      const eventResult = await supabase
        .from('reward_events')
        .select('id,event_type,payload,viewed_at')
        .eq('id', eventId)
        .eq('user_id', userId)
        .eq('event_type', 'card_stage')
        .maybeSingle();
      if (eventResult.error) throw eventResult.error;
      const parsed = eventResult.data ? parseRevealPayload((eventResult.data as { payload: unknown }).payload) : null;
      if (!parsed) return publish({ status: 'not-found' });
      const cardResult = await supabase.from('cards').select(CARD_SELECT).eq('id', parsed.cardId).eq('user_id', userId).maybeSingle();
      if (cardResult.error) throw cardResult.error;
      const row = cardResult.data as unknown as CardRow | null;
      if (!row?.restaurants) return publish({ status: 'not-found' });
      const review = await supabase.from('reviews').select('rating').eq('user_id', userId).eq('restaurant_id', row.restaurants.id).maybeSingle();
      if (review.error) throw review.error;
      const card = toCardView(row, toRating((review.data as { rating: number | string | null } | null)?.rating));
      // The reveal shows the stage this event awarded, even if the card has moved on since.
      publish(card ? { status: 'ready', card: { ...card, stage: parsed.stage }, previousStage: parsed.previousStage, demo: false } : { status: 'not-found' });
    } catch (error) {
      publish({ status: 'error', message: error instanceof Error ? error.message : 'This reveal could not be loaded.' });
    }
  }, [userId, eventId]);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]);

  const retry = useCallback(() => load(), [load]);

  let state: RevealEventState;
  if (eventId === '') state = { status: 'not-found' };
  else if (isDemoEventId(eventId)) state = demoState(eventId);
  else if (stored?.userId === userId && stored.eventId === eventId) state = stored.state;
  else state = { status: 'loading' };
  return { state, retry };
}
