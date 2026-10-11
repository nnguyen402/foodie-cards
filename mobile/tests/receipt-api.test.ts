import { describe, expect, it, vi } from 'vitest';
import { createReceiptApi, ReceiptApiError } from '../src/features/receipts/receipt-api';
import type { ReceiptDraft } from '@foodie-cards/shared';

type FetchMock = typeof fetch & ReturnType<typeof vi.fn>;
const mockFetch = () => vi.fn() as unknown as FetchMock;

const draft: ReceiptDraft = {
  draftId: 'draft-1',
  restaurantId: 'restaurant-1',
  receiptDate: '2026-10-11',
  receiptNumber: null,
  totalMinor: 1250,
  currency: 'USD',
  items: [{ originalText: 'Latte', suggestedName: 'Latte', quantity: 1 }],
  warnings: [],
};

const progression = {
  receiptId: 'receipt-1', cardId: 'card-1',
  xpBreakdown: { visitXP: 100, purchaseBaseXP: 40, multiplier: 1, purchaseXP: 40, totalXP: 140 },
  cardXP: 140, visitCount: 1, stage: 'discovered' as const,
  accountXP: 150, accountLevel: 1, newBadges: ['first_bite'], newTitles: [], revealEventId: 'event-1',
};
const draftUuid = '20000000-0000-4000-8000-000000000001';
const restaurantUuid = '30000000-0000-4000-8000-000000000001';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('receipt API', () => {
  it('loads and validates the current restaurant catalog with the bearer session', async () => {
    const fetcher = mockFetch().mockResolvedValue(jsonResponse({
      restaurants: [{ id: 'restaurant-1', name: 'Cafe Example', locationLabel: 'Midtown' }],
    }));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test/v1', fetcher });

    await expect(api.getRestaurants('fresh-access-token')).resolves.toEqual({
      restaurants: [{ id: 'restaurant-1', name: 'Cafe Example', locationLabel: 'Midtown' }],
    });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/v1/api/receipts/restaurants');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer fresh-access-token');
  });

  it('posts the selected image as multipart and returns the server saved draft', async () => {
    const fetcher = mockFetch().mockResolvedValue(jsonResponse(draft));
    const fields: Array<[string, unknown]> = [];
    const formDataFactory = () => ({ append: (key: string, value: unknown) => fields.push([key, value]) }) as unknown as FormData;
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher, formDataFactory });
    const image = { uri: 'file:///cache/receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' as const };

    await expect(api.extractReceipt('fresh-access-token', image)).resolves.toEqual(draft);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/receipts/extract');
    expect(fields).toEqual([['image', image]]);
    const init = fetcher.mock.calls[0][1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fresh-access-token');
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    expect(init?.body).toBeDefined();
  });

  it('loads only the requested saved draft and validates the response', async () => {
    const fetcher = mockFetch().mockResolvedValue(jsonResponse(draft));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test/', fetcher });

    await expect(api.getDraft('fresh-access-token', 'draft-1')).resolves.toEqual(draft);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/receipts/drafts/draft-1');
  });

  it('submits the confirmed receipt unchanged and parses real progression', async () => {
    const confirmed = {
      draftId: draftUuid, submissionId: '10000000-0000-4000-8000-000000000001',
      restaurantId: restaurantUuid, receiptDate: '2026-10-11', receiptNumber: null,
      totalMinor: 1250, currency: 'USD',
      items: [{ originalText: 'Latte', confirmedName: 'Latte', quantity: 1 }],
    };
    const fetcher = mockFetch().mockResolvedValue(jsonResponse(progression));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher });

    await expect(api.submitReceipt('fresh-access-token', confirmed)).resolves.toEqual(progression);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/receipts/submit');
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify(confirmed));
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer fresh-access-token');
  });

  it('preserves structured API error details for retry decisions', async () => {
    const fetcher = mockFetch().mockResolvedValue(jsonResponse({
      code: 'AI_UNAVAILABLE', message: 'Reader timed out.', retryable: true,
    }, 503));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher });

    await expect(api.extractReceipt('token', { uri: 'file:///receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' }))
      .rejects.toMatchObject({ name: 'ReceiptApiError', code: 'AI_UNAVAILABLE', retryable: true, status: 503 });
  });

  it('turns an unavailable Lane A submit route into a readable error when it returns HTML', async () => {
    const fetcher = mockFetch().mockResolvedValue(new Response('<html>Not Found</html>', { status: 404 }));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher });

    await expect(api.submitReceipt('token', {
      draftId: draftUuid, submissionId: '10000000-0000-4000-8000-000000000001',
      restaurantId: restaurantUuid, receiptDate: '2026-10-11', receiptNumber: null,
      totalMinor: 1250, currency: 'USD', items: [{ originalText: 'Latte', confirmedName: 'Latte', quantity: 1 }],
    }))
      .rejects.toMatchObject({ name: 'ReceiptApiError', status: 404, code: 'NOT_FOUND' });
  });

  it('rejects malformed success payloads instead of showing an invented draft or reward', async () => {
    const fetcher = mockFetch().mockResolvedValue(jsonResponse({ draftId: 'draft-1' }));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher });

    await expect(api.getDraft('token', 'draft-1')).rejects.toBeInstanceOf(ReceiptApiError);
  });

  it('aborts timed out requests and reports a retryable timeout', async () => {
    const fetcher = mockFetch().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher, timeoutMs: 5 });

    await expect(api.getRestaurants('token')).rejects.toMatchObject({ name: 'ReceiptApiError', code: 'TIMEOUT', retryable: true });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('keeps the timeout active while reading the response body', async () => {
    const response = new Response();
    vi.spyOn(response, 'text').mockImplementation(() => new Promise(() => undefined));
    const fetcher = mockFetch().mockResolvedValue(response);
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher, timeoutMs: 5 });

    await expect(api.getRestaurants('token')).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });
  });

  it('does not dispatch a request when its signal is already aborted', async () => {
    const fetcher = mockFetch();
    const controller = new AbortController();
    controller.abort();
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher });

    await expect(api.getRestaurants('token', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects cancellation that arrives while the response body is being read', async () => {
    const response = new Response();
    vi.spyOn(response, 'text').mockImplementation(() => new Promise(() => undefined));
    const fetcher = mockFetch().mockResolvedValue(response);
    const controller = new AbortController();
    const api = createReceiptApi({ baseUrl: 'https://api.example.test', fetcher, timeoutMs: 1_000 });
    const request = api.getRestaurants('token', controller.signal);
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
