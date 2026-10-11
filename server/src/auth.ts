import { createClient } from '@supabase/supabase-js';
import { createProfileActions, type ProfileActions } from './profile/actions.js';
import {
  profileSchema,
  progressionResultSchema,
  reviewResponseSchema,
  type ConfirmedReceipt,
  type Place,
  type Profile,
  type ProgressionResult,
  type ReviewRequest,
  type ReviewResponse,
} from '@foodie-cards/shared';

export type AuthenticatedUser = { userId: string };
export type ReceiptMenuItem = { id: string; canonicalName: string; aliases: string[] };
export type OwnedReceiptDraft = {
  restaurantName?: string | null;
  imagePath: string | null;
  imageHash: string | null;
  status: 'draft' | 'confirmed' | 'accepted' | 'rejected';
  submissionId: string | null;
  acceptanceResult: unknown;
};
export type PendingReward = { eventId: string; createdAt: string; result: ProgressionResult };
export type PlaceSubmission = Omit<ConfirmedReceipt, 'restaurantId' | 'place'> & { place: Place };

export type ServerDependencies = Partial<ProfileActions> & {
  verifyAccessToken: (token: string) => Promise<AuthenticatedUser | null>;
  loadProfile: (userId: string) => Promise<Profile | null>;
  loadReceiptDraft?: (userId: string, draftId: string) => Promise<OwnedReceiptDraft | null>;
  loadRestaurantMenu?: (restaurantId: string) => Promise<{ restaurantId: string; items: ReceiptMenuItem[] } | null>;
  acceptReceipt?: (userId: string, receiptId: string, submissionId: string, confirmed: ConfirmedReceipt & { items: Array<ConfirmedReceipt['items'][number] & { menuItemId: string }> }) => Promise<ProgressionResult>;
  acceptPlaceReceipt?: (userId: string, receiptId: string, submissionId: string, confirmed: PlaceSubmission) => Promise<ProgressionResult>;
  saveReview?: (userId: string, restaurantId: string, review: ReviewRequest) => Promise<ReviewResponse>;
  acknowledgeReward?: (userId: string, eventId: string) => Promise<{ eventId: string; viewedAt: string } | null>;
  loadPendingRewards?: (userId: string) => Promise<PendingReward[]>;
};

export function createSupabaseDependencies(
  env: Record<string, string | undefined> = process.env,
): ServerDependencies | undefined {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return undefined;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return {
    ...createProfileActions(supabase),
    async verifyAccessToken(token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        const status = 'status' in error ? error.status : undefined;
        if (status === 401 || status === 403) return null;
        throw error;
      }
      return data.user ? { userId: data.user.id } : null;
    },
    async loadProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_key, account_xp, equipped_title_key')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const parsed = profileSchema.safeParse({
        userId: data.id,
        displayName: data.display_name,
        avatarKey: data.avatar_key,
        accountXP: data.account_xp,
        accountLevel: 1 + Math.floor(data.account_xp / 200),
        equippedTitleKey: data.equipped_title_key,
      });
      if (!parsed.success) throw new Error('Stored profile does not match the public profile contract');
      return parsed.data;
    },
    async loadReceiptDraft(userId, draftId) {
      const { data, error } = await supabase
        .from('receipts')
        .select('image_path, image_hash, status, submission_id, acceptance_result, extraction_draft')
        .eq('id', draftId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (!['draft', 'confirmed', 'accepted', 'rejected'].includes(data.status)) throw new Error('Invalid stored receipt status');
      return {
        restaurantName: data.extraction_draft && typeof data.extraction_draft === 'object' && 'restaurantName' in data.extraction_draft
          ? (data.extraction_draft as { restaurantName?: string | null }).restaurantName : null,
        imagePath: data.image_path,
        imageHash: data.image_hash,
        status: data.status as OwnedReceiptDraft['status'],
        submissionId: data.submission_id,
        acceptanceResult: data.acceptance_result,
      };
    },
    async loadRestaurantMenu(restaurantId) {
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants').select('id').eq('id', restaurantId).maybeSingle();
      if (restaurantError) throw restaurantError;
      if (!restaurant) return null;
      const { data, error } = await supabase
        .from('menu_items').select('id, canonical_name, aliases').eq('restaurant_id', restaurantId);
      if (error) throw error;
      return {
        restaurantId: restaurant.id,
        items: (data ?? []).map((item) => ({
          id: item.id,
          canonicalName: item.canonical_name,
          aliases: item.aliases ?? [],
        })),
      };
    },
    async acceptReceipt(userId, receiptId, submissionId, confirmed) {
      const { data, error } = await supabase.rpc('accept_receipt', {
        p_user_id: userId,
        p_receipt_id: receiptId,
        p_submission_id: submissionId,
        p_confirmed: confirmed,
      });
      if (error) throw error;
      const parsed = progressionResultSchema.safeParse(data);
      if (!parsed.success) throw new Error('Receipt acceptance returned an invalid result');
      return parsed.data;
    },
    async acceptPlaceReceipt(userId, receiptId, submissionId, confirmed) {
      const { data, error } = await supabase.rpc('accept_place_receipt', {
        p_user_id: userId,
        p_receipt_id: receiptId,
        p_submission_id: submissionId,
        p_confirmed: confirmed,
      });
      if (error) throw error;
      const parsed = progressionResultSchema.safeParse(data);
      if (!parsed.success) throw new Error('Place receipt acceptance returned an invalid result');
      return parsed.data;
    },
    async saveReview(userId, restaurantId, review) {
      const { data, error } = await supabase.rpc('save_review', {
        p_user_id: userId,
        p_restaurant_id: restaurantId,
        p_rating: review.rating,
        p_text: review.text,
      });
      if (error) throw error;
      const parsed = reviewResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error('Review save returned an invalid result');
      return parsed.data;
    },
    async acknowledgeReward(userId, eventId) {
      const { data, error } = await supabase.rpc('acknowledge_reward', {
        p_user_id: userId,
        p_event_id: eventId,
      });
      if (error) throw error;
      if (data === null) return null;
      if (typeof data !== 'object' || typeof data.eventId !== 'string' || typeof data.viewedAt !== 'string') {
        throw new Error('Reward acknowledgement returned an invalid result');
      }
      return { eventId: data.eventId, viewedAt: data.viewedAt };
    },
    async loadPendingRewards(userId) {
      const { data: events, error: eventsError } = await supabase
        .from('reward_events')
        .select('id, receipt_id, created_at')
        .eq('user_id', userId)
        .eq('event_type', 'card_stage')
        .is('viewed_at', null)
        .order('created_at', { ascending: true })
        .limit(50);
      if (eventsError) throw eventsError;
      const receiptIds = [...new Set((events ?? []).map((event) => event.receipt_id).filter((id): id is string => !!id))];
      if (!receiptIds.length) return [];
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, acceptance_result')
        .eq('user_id', userId)
        .in('id', receiptIds);
      if (receiptsError) throw receiptsError;
      const results = new Map<string, ProgressionResult>();
      for (const receipt of receipts ?? []) {
        const parsed = progressionResultSchema.safeParse(receipt.acceptance_result);
        if (parsed.success && parsed.data.receiptId === receipt.id) results.set(receipt.id, parsed.data);
      }
      return (events ?? []).flatMap((event) => {
        const result = event.receipt_id ? results.get(event.receipt_id) : undefined;
        if (!result) return [];
        return [{ eventId: event.id, createdAt: event.created_at, result }];
      });
    },
  };
}
