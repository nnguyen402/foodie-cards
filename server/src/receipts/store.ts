import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { receiptDraftSchema, receiptRestaurantSchema, type ReceiptDraft } from '@foodie-cards/shared';
import { extractReceipt, type ReceiptImage } from './extract.js';

export type ReceiptCatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  locationLabel: string;
};

export interface ReceiptDependencies {
  extractImage(image: ReceiptImage, catalog: ReceiptCatalogEntry[]): Promise<ReceiptDraft>;
  listRestaurants(): Promise<ReceiptCatalogEntry[]>;
  saveDraft(userId: string, image: ReceiptImage, draft: ReceiptDraft): Promise<ReceiptDraft>;
  loadDraft(userId: string, draftId: string): Promise<ReceiptDraft | null>;
}

export class ReceiptDependencyError extends Error {
  constructor(
    readonly code: 'CONFIGURATION_ERROR' | 'AI_UNAVAILABLE' | 'UPLOAD_FAILED' | 'INTERNAL_ERROR',
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'ReceiptDependencyError';
  }
}

function imageExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  throw new ReceiptDependencyError('UPLOAD_FAILED', false);
}

export function createReceiptDependencies(
  env: Record<string, string | undefined> = process.env,
): ReceiptDependencies | undefined {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return undefined;

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return {
    async extractImage(image, catalog) {
      if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
        throw new ReceiptDependencyError('CONFIGURATION_ERROR', false);
      }
      try {
        return await extractReceipt(image, { env, restaurants: catalog });
      } catch {
        throw new ReceiptDependencyError('AI_UNAVAILABLE', true);
      }
    },

    async listRestaurants() {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, aliases, location_label')
        .order('name', { ascending: true });
      if (error || !data) throw new ReceiptDependencyError('INTERNAL_ERROR', true);

      return data.map((row) => {
        const parsed = receiptRestaurantSchema.safeParse({
          id: row.id,
          name: row.name,
          locationLabel: row.location_label,
        });
        if (!parsed.success || !Array.isArray(row.aliases) || !row.aliases.every((alias) => typeof alias === 'string')) {
          throw new ReceiptDependencyError('INTERNAL_ERROR', true);
        }
        return { ...parsed.data, aliases: row.aliases };
      });
    },

    async saveDraft(userId, image, draft) {
      const validatedDraft = receiptDraftSchema.parse(draft);
      const path = `${userId}/${validatedDraft.draftId}.${imageExtension(image.mimeType)}`;
      const bucket = supabase.storage.from('receipts');
      const { error: uploadError } = await bucket.upload(path, Buffer.from(image.bytes), {
        contentType: image.mimeType,
        upsert: false,
      });
      if (uploadError) throw new ReceiptDependencyError('UPLOAD_FAILED', true);

      try {
        const { data, error } = await supabase.from('receipts').insert({
          id: validatedDraft.draftId,
          user_id: userId,
          restaurant_id: validatedDraft.restaurantId,
          receipt_date: validatedDraft.receiptDate,
          receipt_number: validatedDraft.receiptNumber,
          total_minor: validatedDraft.totalMinor,
          currency: validatedDraft.currency,
          image_path: path,
          image_hash: createHash('sha256').update(image.bytes).digest('hex'),
          fingerprint: null,
          extraction_draft: validatedDraft,
          status: 'draft',
          submission_id: null,
        }).select('id').single();

        if (error || !data || data.id !== validatedDraft.draftId) {
          throw new ReceiptDependencyError('UPLOAD_FAILED', true);
        }
        return validatedDraft;
      } catch {
        await bucket.remove([path]).catch(() => undefined);
        throw new ReceiptDependencyError('UPLOAD_FAILED', true);
      }
    },

    async loadDraft(userId, draftId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draftId)) {
        return null;
      }
      const { data, error } = await supabase
        .from('receipts')
        .select('id, extraction_draft')
        .eq('id', draftId)
        .eq('user_id', userId)
        .eq('status', 'draft')
        .maybeSingle();
      if (error) throw new ReceiptDependencyError('INTERNAL_ERROR', true);
      if (!data) return null;
      const draft = receiptDraftSchema.safeParse(data.extraction_draft);
      if (!draft.success || draft.data.draftId !== data.id) {
        throw new ReceiptDependencyError('INTERNAL_ERROR', false);
      }
      return draft.data;
    },
  };
}
