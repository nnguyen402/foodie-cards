import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { createRequestTracker } from '../loadState';
import { firstUnhandled } from './revealEvent';

type Stored = { userId: string; eventId: string | null };

// Newest unviewed card_stage reward of the signed-in user, refetched on focus. Errors resolve to null.
export function usePendingReveal(): { eventId: string | null } {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [stored, setStored] = useState<Stored | null>(null);
  const tracker = useRef(createRequestTracker(userId));
  tracker.current.reset(userId);

  const load = useCallback(async (isActive: () => boolean) => {
    if (!supabase || !userId) return;
    const token = tracker.current.next();
    let eventId: string | null = null;
    try {
      const { data, error } = await supabase
        .from('reward_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'card_stage')
        .is('viewed_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data) eventId = firstUnhandled((data as { id: string }[]).map((row) => String(row.id)));
    } catch {
      eventId = null;
    }
    if (!isActive() || !tracker.current.isLatest(token)) return;
    setStored({ userId, eventId });
  }, [userId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  return { eventId: userId !== '' && stored?.userId === userId ? stored.eventId : null };
}
