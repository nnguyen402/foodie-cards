import { z } from 'zod';
import { confirmedReceiptBaseSchema, placeSchema, type ConfirmedReceipt, type Place } from '@foodie-cards/shared';
import type { ReceiptMenuItem } from '../auth.js';

export const uuidSchema = z.string().uuid();
const receiptItemSubmissionSchema = z.object({
  originalText: z.string().trim().min(1).max(240),
  confirmedName: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
}).strict();

export const safeConfirmedReceiptSchema = confirmedReceiptBaseSchema.extend({
  draftId: uuidSchema,
  submissionId: uuidSchema,
  restaurantId: uuidSchema.optional(),
  place: placeSchema.optional(),
  receiptNumber: z.string().trim().max(120).nullable(),
  totalMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  items: z.array(receiptItemSubmissionSchema).min(1).max(100),
}).strict().refine((value) => (value.restaurantId === undefined) !== (value.place === undefined));

export type PlaceSubmission = Omit<ConfirmedReceipt, 'restaurantId' | 'place'> & { place: Place };

function normalizedMenuName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export class ReceiptItemResolutionError extends Error {
  constructor(readonly reason: 'unresolved' | 'ambiguous' | 'invalid_menu') {
    super(reason);
  }
}

export function canonicalizeReceiptItems(items: ConfirmedReceipt['items'], menu: ReceiptMenuItem[]) {
  const names = new Map<string, ReceiptMenuItem>();
  for (const menuItem of menu) {
    if (!uuidSchema.safeParse(menuItem.id).success || typeof menuItem.canonicalName !== 'string' || !Array.isArray(menuItem.aliases)) {
      throw new ReceiptItemResolutionError('invalid_menu');
    }
    for (const name of [menuItem.canonicalName, ...menuItem.aliases]) {
      if (typeof name !== 'string' || !name.trim()) continue;
      const key = normalizedMenuName(name);
      const existing = names.get(key);
      if (existing && existing.id !== menuItem.id) throw new ReceiptItemResolutionError('ambiguous');
      names.set(key, menuItem);
    }
  }

  const merged = new Map<string, { originalText: string; confirmedName: string; quantity: number; menuItemId: string }>();
  for (const item of items) {
    const matched = names.get(normalizedMenuName(item.confirmedName));
    if (!matched) throw new ReceiptItemResolutionError('unresolved');
    const existing = merged.get(matched.id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.originalText = `${existing.originalText}; ${item.originalText}`.slice(0, 240);
    } else {
      merged.set(matched.id, {
        originalText: item.originalText,
        confirmedName: matched.canonicalName,
        quantity: item.quantity,
        menuItemId: matched.id,
      });
    }
  }
  return [...merged.values()];
}
