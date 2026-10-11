import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type ServerDependencies } from '../src/app.ts';

const draft = {
  draftId: 'draft-1',
  restaurantName: 'Busy Bee Cafe',
  restaurantId: 'restaurant-1',
  receiptDate: null,
  receiptNumber: null,
  totalMinor: null,
  currency: null,
  items: [{ originalText: 'Coffee', suggestedName: 'Coffee', quantity: 1 }],
  warnings: ['Check receipt date.'],
};

const restaurant = { id: 'restaurant-1', name: 'Busy Bee Cafe', aliases: ['Busy Bee'], locationLabel: 'Atlanta' };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function authDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  return {
    verifyAccessToken: vi.fn(async (token: string) => token === 'valid-token' ? { userId: 'user-1' } : null),
    loadProfile: vi.fn(async () => null),
    ...overrides,
  };
}

function appWith(receiptDependencies: Record<string, unknown> | null = {
  extractImage: vi.fn(async () => draft),
  listRestaurants: vi.fn(async () => [restaurant]),
  saveDraft: vi.fn(async (_userId: string, _image: unknown, value: typeof draft) => ({ ...value, draftId: 'saved-draft' })),
  loadDraft: vi.fn(async (userId: string, draftId: string) => userId === 'user-1' && draftId === 'draft-1' ? draft : null),
}) : Express {
  const createAppWithReceiptDependencies = createApp as unknown as (
    auth?: ServerDependencies,
    receipts?: unknown,
  ) => Express;
  return createAppWithReceiptDependencies(authDependencies(), receiptDependencies);
}

function authenticatedUpload(app: Express, image: Buffer = png, mimeType = 'image/png') {
  return request(app)
    .post('/api/receipts/extract')
    .set('Authorization', 'Bearer valid-token')
    .attach('image', image, { filename: 'receipt.png', contentType: mimeType });
}

describe('authenticated receipt draft routes', () => {
  it('authenticates before parsing an unsupported uploaded image', async () => {
    const extractImage = vi.fn(async () => draft);
    const app = appWith({ extractImage });

    const response = await request(app)
      .post('/api/receipts/extract')
      .attach('image', png, { filename: 'receipt.bin', contentType: 'text/plain' })
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(extractImage).not.toHaveBeenCalled();
  });

  it('extracts, persists, and returns the saved draft for the verified user', async () => {
    const extractImage = vi.fn(async () => draft);
    const saveDraft = vi.fn(async (_userId: string, _image: unknown, value: typeof draft) => ({ ...value, draftId: 'saved-draft' }));
    const app = appWith({ extractImage, saveDraft, listRestaurants: vi.fn(async () => [restaurant]) });

    const response = await authenticatedUpload(app).expect(200);

    expect(response.body).toEqual({ ...draft, draftId: 'saved-draft' });
    expect(extractImage).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/png' }), [restaurant]);
    expect(saveDraft).toHaveBeenCalledWith('user-1', expect.objectContaining({ mimeType: 'image/png' }), draft);
  });

  it('rejects a missing image with a JSON receipt error', async () => {
    const response = await request(appWith()).post('/api/receipts/extract')
      .set('Authorization', 'Bearer valid-token').field('unused', 'value').expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT', retryable: false });
  });

  it('rejects image bytes whose signature disagrees with the declared MIME type', async () => {
    const extractImage = vi.fn(async () => draft);
    const response = await authenticatedUpload(appWith({ extractImage }), Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/png').expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT' });
    expect(extractImage).not.toHaveBeenCalled();
  });

  it('rejects an empty image before invoking extraction', async () => {
    const extractImage = vi.fn(async () => draft);
    const response = await authenticatedUpload(appWith({ extractImage }), Buffer.alloc(0)).expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT' });
    expect(extractImage).not.toHaveBeenCalled();
  });

  it('rejects multipart fields other than the single image', async () => {
    const response = await authenticatedUpload(appWith(), png)
      .field('restaurantId', 'restaurant-1').expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT' });
  });

  it('rejects images larger than 10 MiB before extraction', async () => {
    const extractImage = vi.fn(async () => draft);
    const response = await authenticatedUpload(appWith({ extractImage }), Buffer.alloc(10 * 1024 * 1024 + 1)).expect(413);

    expect(response.body).toMatchObject({ code: 'INVALID_RECEIPT' });
    expect(extractImage).not.toHaveBeenCalled();
  });

  it('returns only the requesting owner’s draft and hides foreign drafts as not found', async () => {
    const loadDraft = vi.fn(async () => null);
    const app = appWith({ loadDraft });
    const response = await request(app).get('/api/receipts/drafts/foreign-draft')
      .set('Authorization', 'Bearer valid-token').expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(loadDraft).toHaveBeenCalledWith('user-1', 'foreign-draft');
  });

  it('returns an owned draft through the authenticated draft route', async () => {
    const loadDraft = vi.fn(async () => draft);
    const response = await request(appWith({ loadDraft })).get(`/api/receipts/drafts/${draft.draftId}`)
      .set('Authorization', 'Bearer valid-token').expect(200);

    expect(response.body).toEqual(draft);
    expect(loadDraft).toHaveBeenCalledWith('user-1', draft.draftId);
  });

  it('returns the restaurant catalog in its shared response shape', async () => {
    const response = await request(appWith()).get('/api/receipts/restaurants')
      .set('Authorization', 'Bearer valid-token').expect(200);

    expect(response.body).toEqual({ restaurants: [{ id: restaurant.id, name: restaurant.name, locationLabel: restaurant.locationLabel }] });
  });

  it('returns safe retryable service errors without leaking provider details', async () => {
    const app = appWith({
      listRestaurants: vi.fn(async () => [restaurant]),
      extractImage: vi.fn(async () => { throw new Error('raw Gemini diagnostic detail'); }),
      saveDraft: vi.fn(),
    });
    const response = await authenticatedUpload(app).expect(503);

    expect(response.body).toMatchObject({ code: 'AI_UNAVAILABLE', retryable: true });
    expect(JSON.stringify(response.body)).not.toContain('raw Gemini diagnostic detail');
  });

  it('returns a JSON configuration error when receipt dependencies are missing', async () => {
    const response = await authenticatedUpload(appWith(null)).expect(503);

    expect(response.body).toMatchObject({ code: 'CONFIGURATION_ERROR', retryable: false });
  });
});
