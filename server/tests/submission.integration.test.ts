import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';

const userId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const otherUserId = '6ba7b811-9dad-41d1-80b4-00c04fd430c8';
const restaurantId = '6ba7b812-9dad-41d1-80b4-00c04fd430c8';
const draftId = '6ba7b813-9dad-41d1-80b4-00c04fd430c8';
const submissionId = '6ba7b814-9dad-41d1-80b4-00c04fd430c8';
const itemId = '6ba7b815-9dad-41d1-80b4-00c04fd430c8';
const eventId = '6ba7b816-9dad-41d1-80b4-00c04fd430c8';

const confirmed = {
  draftId, submissionId, restaurantId, receiptDate: '2026-10-01', receiptNumber: '17',
  totalMinor: 1250, currency: 'USD',
  items: [
    { originalText: 'BBQ sand', confirmedName: '  BBQ   Sandwich ', quantity: 1 },
    { originalText: 'Sandwich', confirmedName: 'bbq sandwich', quantity: 2 },
  ],
};

const progression = {
  receiptId: draftId, cardId: '6ba7b817-9dad-41d1-80b4-00c04fd430c8',
  xpBreakdown: { visitXP: 100, purchaseBaseXP: 40, multiplier: 1, purchaseXP: 40, totalXP: 140 },
  cardXP: 140, visitCount: 1, stage: 'discovered', accountXP: 150, accountLevel: 1,
  newBadges: ['first_bite'], newTitles: [], revealEventId: eventId,
};

const reviewResponse = {
  review: { restaurantId, rating: 0, text: 'Great visit', updatedAt: '2026-10-01T12:00:00.000Z' },
  accountXP: 0, accountLevel: 1, newBadges: [], newTitles: [],
};

function appWith(overrides: Record<string, unknown> = {}): Express {
  const dependencies = {
    verifyAccessToken: vi.fn(async (token: string) => token === 'valid-token' ? { userId } : null),
    loadProfile: vi.fn(async () => null),
    loadReceiptDraft: vi.fn(async (ownerId: string, id: string) => ownerId === userId && id === draftId ? {
      imagePath: `${userId}/receipt.jpg`, imageHash: 'a'.repeat(64), status: 'draft',
      submissionId: null, acceptanceResult: null,
    } : null),
    loadRestaurantMenu: vi.fn(async (id: string) => id === restaurantId ? {
      restaurantId,
      items: [{ id: itemId, canonicalName: 'BBQ Sandwich', aliases: ['BBQ Sand', 'Pulled Pork Sandwich'] }],
    } : null),
    acceptReceipt: vi.fn(async () => progression),
    saveReview: vi.fn(async () => reviewResponse),
    acknowledgeReward: vi.fn(async () => ({ eventId, viewedAt: '2026-10-01T12:00:00.000Z' })),
    loadPendingRewards: vi.fn(async () => [{ eventId, stage: 'discovered', createdAt: '2026-10-01T12:00:00.000Z' }]),
    ...overrides,
  };
  return createApp(dependencies as never);
}

function authed(app: Express) {
  return request(app).post('/api/receipts/submit').set('Authorization', 'Bearer valid-token');
}

describe('receipt submission', () => {
  it('requires verified authentication and rejects forged tokens', async () => {
    const app = appWith();
    await request(app).post('/api/receipts/submit').send(confirmed).expect(401);
    await request(app).post('/api/receipts/submit').set('Authorization', 'Bearer forged-token').send(confirmed).expect(401);
  });

  it('rejects malformed and unsafe confirmation data before database writes', async () => {
    const acceptReceipt = vi.fn();
    const app = appWith({ acceptReceipt });
    await authed(app).send({ ...confirmed, draftId: 'not-a-uuid' }).expect(400);
    await authed(app).send({ ...confirmed, clientXP: 900 }).expect(400);
    await authed(app).send({ ...confirmed, imageHash: 'a'.repeat(64) }).expect(400);
    await authed(app).send({ ...confirmed, items: [{ ...confirmed.items[0], quantity: 1000000 }] }).expect(400);
    expect(acceptReceipt).not.toHaveBeenCalled();
  });

  it('rejects oversized JSON request bodies with the public API error shape', async () => {
    const response = await authed(appWith()).send({ ...confirmed, receiptNumber: 'x'.repeat(40000) }).expect(413);
    expect(response.body).toMatchObject({ code: 'INVALID_REQUEST', retryable: false });
  });

  it('requires a draft owned by the authenticated account', async () => {
    const loadReceiptDraft = vi.fn(async () => null);
    const app = appWith({ loadReceiptDraft });
    const response = await authed(app).send(confirmed).expect(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects drafts whose stored image path or server hash is unsafe', async () => {
    const app = appWith({ loadReceiptDraft: vi.fn(async () => ({
      imagePath: `${otherUserId}/receipt.jpg`, imageHash: 'a'.repeat(64), status: 'draft',
      submissionId: null, acceptanceResult: null,
    })) });
    await authed(app).send(confirmed).expect(400);
  });

  it('requires exact normalized canonical-name or alias matches and rejects unresolved items', async () => {
    const acceptReceipt = vi.fn();
    const response = await authed(appWith({ acceptReceipt })).send({
      ...confirmed, items: [{ originalText: 'Mystery', confirmedName: 'Something Similar', quantity: 1 }],
    }).expect(400);
    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT', retryable: false });
    expect(acceptReceipt).not.toHaveBeenCalled();
  });

  it('merges duplicate canonical items and sends no client reward fields to the database RPC', async () => {
    const acceptReceipt = vi.fn(async () => progression);
    const app = appWith({ acceptReceipt });
    const response = await authed(app).send(confirmed).expect(200);
    expect(response.body).toEqual(progression);
    expect(acceptReceipt).toHaveBeenCalledWith(userId, draftId, submissionId, expect.objectContaining({
      restaurantId,
      items: [{ originalText: 'BBQ sand; Sandwich', confirmedName: 'BBQ Sandwich', quantity: 3, menuItemId: itemId }],
    }));
    expect(JSON.stringify(acceptReceipt.mock.calls[0])).not.toContain('clientXP');
  });

  it('replays an accepted submission without requiring a menu match after catalog changes', async () => {
    const acceptReceipt = vi.fn(async () => progression);
    const loadRestaurantMenu = vi.fn(async () => null);
    const loadReceiptDraft = vi.fn(async () => ({
      imagePath: `${userId}/receipt.jpg`, imageHash: 'a'.repeat(64), status: 'accepted',
      submissionId, acceptanceResult: progression,
    }));
    const response = await authed(appWith({ acceptReceipt, loadRestaurantMenu, loadReceiptDraft })).send(confirmed).expect(200);
    expect(response.body).toEqual(progression);
    expect(loadRestaurantMenu).not.toHaveBeenCalled();
    expect(acceptReceipt).not.toHaveBeenCalled();
  });

  it('maps duplicate conflicts to a safe public error without exposing backend detail', async () => {
    const app = appWith({ acceptReceipt: vi.fn(async () => { throw new Error('DUPLICATE_RECEIPT: private_fingerprint SQL detail'); }) });
    const response = await authed(app).send(confirmed).expect(409);
    expect(response.body).toMatchObject({ code: 'DUPLICATE_RECEIPT', retryable: false });
    expect(JSON.stringify(response.body)).not.toContain('private_fingerprint');
  });
});

describe('reviews and reward recovery', () => {
  it('validates reviews and delegates card ownership and atomic badge awards to the RPC', async () => {
    const saveReview = vi.fn(async () => reviewResponse);
    const app = appWith({ saveReview });
    await request(app).patch(`/api/reviews/${restaurantId}`).set('Authorization', 'Bearer valid-token')
      .send({ rating: 1.25, text: '' }).expect(400);
    const response = await request(app).patch(`/api/reviews/${restaurantId}`).set('Authorization', 'Bearer valid-token')
      .send({ rating: 0, text: 'Great visit' }).expect(200);
    expect(response.body).toEqual(reviewResponse);
    expect(saveReview).toHaveBeenCalledWith(userId, restaurantId, { rating: 0, text: 'Great visit' });
  });

  it('records reveal acknowledgement through the owner-scoped idempotent service', async () => {
    const acknowledgeReward = vi.fn(async () => ({ eventId, viewedAt: '2026-10-01T12:00:00.000Z' }));
    const app = appWith({ acknowledgeReward });
    const response = await request(app).post(`/api/rewards/${eventId}/viewed`)
      .set('Authorization', 'Bearer valid-token').expect(200);
    expect(response.body).toEqual({ eventId, viewedAt: '2026-10-01T12:00:00.000Z' });
    expect(acknowledgeReward).toHaveBeenCalledWith(userId, eventId);
  });

  it('returns only owned unviewed card-stage rewards for interrupted reveal recovery', async () => {
    const regularResult = { ...progression, stage: 'regular' as const, cardXP: 340 };
    const loadPendingRewards = vi.fn(async () => [{ eventId, createdAt: '2026-10-01T12:00:00.000Z', result: regularResult }]);
    const response = await request(appWith({ loadPendingRewards })).get('/api/rewards/pending')
      .set('Authorization', 'Bearer valid-token').expect(200);
    expect(response.body).toEqual({ rewards: [{ eventId, createdAt: '2026-10-01T12:00:00.000Z', result: regularResult }] });
    expect(loadPendingRewards).toHaveBeenCalledWith(userId);
    expect(JSON.stringify(response.body)).not.toMatch(/receiptNumber|imagePath|totalMinor|imageHash/i);
  });
});
