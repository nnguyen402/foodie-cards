import { reviewRequestSchema, type ReviewRequest } from '@foodie-cards/shared';
import { supabase } from '@/lib/supabase';

export type ExistingReview =
  | { ownsCard: false; review: null }
  | { ownsCard: true; review: ReviewRequest };

export async function loadExistingReview(
  userId: string,
  restaurantId: string,
): Promise<ExistingReview> {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!userId || !restaurantId) throw new Error('A signed-in user and restaurant are required.');

  const cardResult = await supabase
    .from('cards')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (cardResult.error) throw new Error(cardResult.error.message || 'Card ownership could not be checked.');
  if (!cardResult.data) return { ownsCard: false, review: null };

  const reviewResult = await supabase
    .from('reviews')
    .select('rating,text')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (reviewResult.error) throw new Error(reviewResult.error.message || 'Your review could not be loaded.');

  const row = reviewResult.data as { rating?: number | string | null; text?: string } | null;
  const numericRating = row?.rating == null ? null : Number(row.rating);
  const parsed = reviewRequestSchema.safeParse({
    rating: numericRating,
    text: row?.text ?? '',
  });
  if (!parsed.success) throw new Error('Your saved review could not be read.');

  return { ownsCard: true, review: parsed.data };
}
