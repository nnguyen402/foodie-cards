import { describe, expect, it, vi } from 'vitest';
import { extractReceipt } from '../src/receipts/extract.ts';
import { normalizeItems } from '../src/receipts/normalize.ts';

const catalog = {
  restaurants: [
    {
      id: 'busy-bee',
      name: 'Busy Bee Cafe',
      aliases: ['The Busy Bee', 'Busy Bee Café'],
    },
    {
      id: 'fox-bros',
      name: 'Fox Bros Bar-B-Q',
      aliases: ['Fox Bros BBQ'],
    },
  ],
  menuItems: [
    {
      id: 'fried-chicken',
      restaurantId: 'busy-bee',
      canonicalName: 'Fried chicken',
      aliases: ['honey chicken'],
    },
    {
      id: 'mac-and-cheese',
      restaurantId: 'busy-bee',
      canonicalName: 'Macaroni and cheese',
      aliases: ['mac and cheese', 'macaroni & cheese'],
    },
  ],
};

describe('normalizeItems', () => {
  it('excludes tax, tip, and payment lines', () => {
    const result = normalizeItems('busy-bee', [
      { originalText: 'Fried chicken', suggestedName: 'Fried chicken', quantity: 1, kind: 'food', confidence: 'certain' },
      { originalText: 'Sales tax', suggestedName: 'Sales tax', quantity: 1, kind: 'non_food', confidence: 'certain' },
      { originalText: 'Tip', suggestedName: 'Tip', quantity: 1, kind: 'non_food', confidence: 'certain' },
      { originalText: 'Visa payment', suggestedName: 'Visa payment', quantity: 1, kind: 'non_food', confidence: 'certain' },
    ], catalog);

    expect(result.items).toEqual([
      { menuItemId: 'fried-chicken', canonicalName: 'Fried chicken', originalText: 'Fried chicken', quantity: 1 },
    ]);
    expect(result.unresolvedItems).toEqual([]);
  });

  it('defaults a missing quantity to one', () => {
    const result = normalizeItems('busy-bee', [
      { originalText: 'Honey chicken', suggestedName: 'Honey chicken', kind: 'food', confidence: 'certain' },
    ], catalog);

    expect(result.items[0]).toMatchObject({ menuItemId: 'fried-chicken', quantity: 1 });
  });

  it('merges duplicate dish lines and quantities', () => {
    const result = normalizeItems('busy-bee', [
      { originalText: 'Fried chicken', suggestedName: 'Fried chicken', quantity: 1, kind: 'food', confidence: 'certain' },
      { originalText: 'Honey chicken', suggestedName: 'Honey chicken', quantity: 2, kind: 'food', confidence: 'certain' },
    ], catalog);

    expect(result.items).toEqual([
      { menuItemId: 'fried-chicken', canonicalName: 'Fried chicken', originalText: 'Fried chicken', quantity: 3 },
    ]);
  });

  it('leaves items unresolved when the restaurant is unknown', () => {
    const result = normalizeItems('unknown-restaurant', [
      { originalText: 'Fried chicken', suggestedName: 'Fried chicken', quantity: 1, kind: 'food', confidence: 'certain' },
    ], catalog);

    expect(result.restaurantId).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.unresolvedItems).toEqual([
      expect.objectContaining({ originalText: 'Fried chicken', reason: 'unknown_restaurant' }),
    ]);
  });

  it('maps known aliases to the same canonical menu item', () => {
    const result = normalizeItems('busy-bee', [
      { originalText: 'Mac & cheese', suggestedName: 'mac and cheese', quantity: 1, kind: 'food', confidence: 'certain' },
      { originalText: 'Macaroni & cheese', suggestedName: 'macaroni & cheese', quantity: 1, kind: 'food', confidence: 'certain' },
    ], catalog);

    expect(result.items).toEqual([
      { menuItemId: 'mac-and-cheese', canonicalName: 'Macaroni and cheese', originalText: 'Mac & cheese', quantity: 2 },
    ]);
  });

  it('keeps uncertain names unresolved instead of inventing a menu match', () => {
    const result = normalizeItems('busy-bee', [
      { originalText: 'Chkn spcl', suggestedName: 'Fried chicken', quantity: 1, kind: 'food', confidence: 'uncertain' },
    ], catalog);

    expect(result.items).toEqual([]);
    expect(result.unresolvedItems).toEqual([
      expect.objectContaining({ originalText: 'Chkn spcl', suggestedName: 'Fried chicken', reason: 'uncertain_match' }),
    ]);
  });
});

describe('extractReceipt', () => {
  const successfulResponse = () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              restaurantName: 'Busy Bee Cafe',
              receiptDate: '2026-10-01',
              receiptNumber: null,
              totalMinor: 1850,
              currency: 'USD',
              items: [{
                originalText: 'Hny Chkn',
                suggestedName: 'Honey chicken',
                quantity: null,
                kind: 'food',
                confidence: 'uncertain',
              }],
            }),
          }],
        },
      }],
    }),
  });

  it('requests structured JSON, validates it, and preserves original item text', async () => {
    const fetchImpl = vi.fn(async () => successfulResponse());
    const draft = await extractReceipt(
      { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' },
      { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }, fetchImpl },
    );
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body as string);

    expect(requestBody.generationConfig.responseMimeType).toBe('application/json');
    expect(requestBody.generationConfig.responseSchema.properties.items.type).toBe('ARRAY');
    expect(draft.items).toEqual([
      { originalText: 'Hny Chkn', suggestedName: 'Hny Chkn', quantity: 1 },
    ]);
    expect(draft.warnings).toContain('Review uncertain item: "Hny Chkn".');
  });

  it('accepts WebP images and sends them to Gemini as image/webp', async () => {
    const fetchImpl = vi.fn(async (_url: string, options: { body: string }) => successfulResponse());

    await extractReceipt(
      { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/webp' },
      { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }, fetchImpl },
    );

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.contents[0].parts[1].inlineData.mimeType).toBe('image/webp');
  });

  it('retries one transient Gemini failure and never retries a second time', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(successfulResponse());

    const draft = await extractReceipt(
      { bytes: new Uint8Array([1]), mimeType: 'image/png' },
      { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }, fetchImpl },
    );

    expect(draft.items[0].originalText).toBe('Hny Chkn');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sets a 30-second request timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchImpl = vi.fn(async (_url: string, options: { signal: AbortSignal }) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.signal.aborted).toBe(false);
      return successfulResponse();
    });

    try {
      await extractReceipt(
        { bytes: new Uint8Array([1]), mimeType: 'image/webp' },
        { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }, fetchImpl },
      );
      expect(timeout).toHaveBeenCalledWith(30_000);
    } finally {
      timeout.mockRestore();
    }
  });
});
