import { describe, expect, it } from 'vitest';
import {
  confirmedReceiptSchema,
  profileEditRequestSchema,
  profilePinsRequestSchema,
  ratingSchema,
  receiptDraftSchema,
  reviewRequestSchema,
  restaurantThemeSchema,
} from './contracts.ts';

describe('shared API contracts', () => {
  it('accepts a receipt date only in YYYY-MM-DD calendar form', () => {
    expect(receiptDraftSchema.safeParse({
      draftId: 'draft-1', restaurantId: null, receiptDate: '2026-02-30',
      receiptNumber: null, totalMinor: null, currency: null, items: [], warnings: [],
    }).success).toBe(false);
  });

  it('requires positive integer quantities in confirmed receipts', () => {
    expect(confirmedReceiptSchema.safeParse({
      draftId: 'draft-1', submissionId: 'submit-1', restaurantId: 'restaurant-1',
      receiptDate: '2026-03-01', receiptNumber: null, totalMinor: 0, currency: 'USD',
      items: [{ originalText: 'coffee', confirmedName: 'Coffee', quantity: 0 }],
    }).success).toBe(false);
  });

  it('preserves null as unrated and zero as a valid rating', () => {
    expect(ratingSchema.parse(null)).toBeNull();
    expect(ratingSchema.parse(0)).toBe(0);
    expect(ratingSchema.safeParse(1.25).success).toBe(false);
    expect(ratingSchema.safeParse(4.3).success).toBe(true);
    expect(ratingSchema.safeParse(0.1).success).toBe(true);
    expect(ratingSchema.safeParse(4.35).success).toBe(false);
    expect(ratingSchema.safeParse(5.1).success).toBe(false);
    expect(ratingSchema.safeParse(-0.1).success).toBe(false);
  });

  it('accepts only editable profile fields', () => {
    expect(profileEditRequestSchema.safeParse({ displayName: 'Nora', avatarKey: 'fork' }).success).toBe(true);
    expect(profileEditRequestSchema.safeParse({ displayName: 'Nora', avatarKey: 'fork', accountXP: 999 }).success).toBe(false);
  });

  it('limits profile pins to three distinct owned-card slots', () => {
    expect(profilePinsRequestSchema.safeParse({ pins: [
      { cardId: 'card-1', slot: 1 }, { cardId: 'card-2', slot: 2 },
      { cardId: 'card-3', slot: 3 }, { cardId: 'card-4', slot: 4 },
    ] }).success).toBe(false);
    expect(profilePinsRequestSchema.safeParse({ pins: [
      { cardId: 'card-1', slot: 1 }, { cardId: 'card-1', slot: 2 },
    ] }).success).toBe(false);
  });

  it('rejects whitespace-only written reviews and accepts explicit empty text', () => {
    expect(reviewRequestSchema.safeParse({ rating: null, text: '   ' }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ rating: 0, text: '' }).success).toBe(true);
  });

  it('requires theme colors to be hex values', () => {
    expect(restaurantThemeSchema.safeParse({
      primaryColor: 'red', accentColor: '#223344', fontKey: 'rounded', patternKey: 'none',
    }).success).toBe(false);
  });
});

describe('confirmed receipt place', () => {
  const base = { draftId: 'd', submissionId: 's', receiptDate: '2026-10-11', receiptNumber: null, totalMinor: 1000, currency: 'USD', items: [{ originalText: 'x', confirmedName: 'x', quantity: 1 }] };
  const place = { osmType: 'node', osmId: 42, name: 'Chick-fil-A', brandKey: 'name:chick fil a', cuisine: 'chicken', latitude: 33.7, longitude: -84.4 };
  it('accepts a restaurantId or a place', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, restaurantId: 'r1' }).success).toBe(true);
    expect(confirmedReceiptSchema.safeParse({ ...base, place }).success).toBe(true);
  });
  it('rejects both or neither', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, restaurantId: 'r1', place }).success).toBe(false);
    expect(confirmedReceiptSchema.safeParse(base).success).toBe(false);
  });
  it('rejects out-of-range coordinates', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, place: { ...place, latitude: 91 } }).success).toBe(false);
  });
});
