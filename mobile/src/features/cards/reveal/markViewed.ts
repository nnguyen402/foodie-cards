import { supabase } from '@/lib/supabase';
import { isDemoEventId, markRevealHandled } from './revealEvent';

// Tells the server the reveal was seen. The route may not exist yet, so failures are swallowed.
export async function markRewardViewed(eventId: string): Promise<void> {
  if (!eventId || isDemoEventId(eventId)) return;
  markRevealHandled(eventId);
  try {
    const base = process.env.EXPO_PUBLIC_API_URL;
    if (!base || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const url = `${base.replace(/\/+$/, '')}/api/rewards/${encodeURIComponent(eventId)}/viewed`;
    await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch {
    // Best effort only.
  }
}
