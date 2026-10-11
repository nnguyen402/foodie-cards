import { revealAcknowledgementResponseSchema } from '@foodie-cards/shared';
import { supabase } from '@/lib/supabase';
import { isDemoEventId, markRevealHandled } from './revealEvent';

// A completed animation is only dismissed from recovery after the server saves it.
export async function markRewardViewed(eventId: string): Promise<void> {
  if (!eventId || isDemoEventId(eventId)) return;
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base || !supabase) throw new Error('The reveal service is not configured.');
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Sign in again to save this reveal.');
  const url = `${base.replace(/\/+$/, '')}/api/rewards/${encodeURIComponent(eventId)}/viewed`;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The reveal save timed out.'));
    }, 10_000);
  });
  try {
    await Promise.race([timeout, (async () => {
      const response = await fetch(url, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('The reveal could not be saved. Try again.');
      const result = revealAcknowledgementResponseSchema.safeParse(await response.json());
      if (!result.success || result.data.eventId !== eventId) throw new Error('The reveal could not be saved. Try again.');
    })()]);
  } catch {
    throw new Error('The reveal could not be saved. Check your connection and retry.');
  } finally {
    clearTimeout(timer);
  }
  markRevealHandled(eventId);
}
