import {
  apiErrorSchema,
  confirmedReceiptSchema,
  progressionResultSchema,
  receiptDraftSchema,
  receiptRestaurantsResponseSchema,
  type ConfirmedReceipt,
  type ProgressionResult,
  type ReceiptDraft,
  type ReceiptRestaurant,
} from '@foodie-cards/shared';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReceiptImageUpload = { uri: string; name: string; type: 'image/jpeg' | 'image/png' | 'image/webp'; file?: Blob };
export type ReceiptApiOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  formDataFactory?: () => FormData;
};

export class ReceiptApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly retryable: boolean) {
    super(message);
    this.name = 'ReceiptApiError';
  }
}

function joinUrl(baseUrl: string, path: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ReceiptApiError('Receipt service URL is not configured correctly.', 0, 'CONFIGURATION_ERROR', false);
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new ReceiptApiError('Receipt service URL must use HTTP or HTTPS.', 0, 'CONFIGURATION_ERROR', false);
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}${path}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

function accessToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) throw new ReceiptApiError('Sign in again to continue.', 401, 'UNAUTHORIZED', false);
  return normalized;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function responseBody(response: Response): Promise<unknown> {
  return parseJson(await response.text());
}

function readApiError(payload: unknown, status: number, route: string): ReceiptApiError {
  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    return new ReceiptApiError(parsed.data.message, status, parsed.data.code, parsed.data.retryable);
  }
  if (status === 404 && route.endsWith('/api/receipts/submit')) {
    return new ReceiptApiError('Receipt submission is not available yet. Your edits are saved here; try again after the receipt service is updated.', 404, 'NOT_FOUND', false);
  }
  if (status === 404) return new ReceiptApiError('This receipt draft could not be found. Return to Scan and choose the image again.', 404, 'NOT_FOUND', false);
  return new ReceiptApiError('The receipt service returned an unexpected response. Please try again.', status, 'INTERNAL_ERROR', status >= 500);
}

export function createReceiptApi(options: ReceiptApiOptions) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const formDataFactory = options.formDataFactory ?? (() => new FormData());

  async function request<T>(
    path: string,
    token: string,
    init: RequestInit,
    parser: { parse: (value: unknown) => T },
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const url = joinUrl(options.baseUrl, path);
    const bearer = accessToken(token);
    if (externalSignal?.aborted) throw new DOMException('Receipt request cancelled.', 'AbortError');
    const controller = new AbortController();
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const forwardAbort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });

    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ReceiptApiError('Receipt request timed out. Check your connection and retry.', 0, 'TIMEOUT', true));
      }, timeoutMs);
    });
    const cancelled = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => {
        if (!timedOut) reject(new DOMException('Receipt request cancelled.', 'AbortError'));
      }, { once: true });
    });

    try {
      const operation = async () => {
        const response = await fetcher(url, {
          ...init,
          headers: { Accept: 'application/json', ...init.headers, Authorization: `Bearer ${bearer}` },
          signal: controller.signal,
        });
        const payload = await responseBody(response);
        if (!response.ok) throw readApiError(payload, response.status, url);
        try {
          return parser.parse(payload);
        } catch {
          throw new ReceiptApiError('The receipt service returned data in an unexpected format. Please retry.', response.status, 'INVALID_RESPONSE', true);
        }
      };
      return await Promise.race([operation(), timeout, cancelled]);
    } catch (error) {
      if (error instanceof ReceiptApiError) throw error;
      if (externalSignal?.aborted) throw new DOMException('Receipt request cancelled.', 'AbortError');
      if (timedOut) throw new ReceiptApiError('Receipt request timed out. Check your connection and retry.', 0, 'TIMEOUT', true);
      throw new ReceiptApiError('Could not reach the receipt service. Check your connection and retry.', 0, 'NETWORK_ERROR', true);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  }

  return {
    getRestaurants(token: string, signal?: AbortSignal): Promise<{ restaurants: ReceiptRestaurant[] }> {
      return request('/api/receipts/restaurants', token, { method: 'GET' }, receiptRestaurantsResponseSchema, signal);
    },
    extractReceipt(token: string, image: ReceiptImageUpload, signal?: AbortSignal): Promise<ReceiptDraft> {
      const form = formDataFactory();
      if (image.file) form.append('image', image.file, image.name);
      else form.append('image', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
      return request('/api/receipts/extract', token, { method: 'POST', body: form }, receiptDraftSchema, signal);
    },
    getDraft(token: string, draftId: string, signal?: AbortSignal): Promise<ReceiptDraft> {
      return request(`/api/receipts/drafts/${encodeURIComponent(draftId)}`, token, { method: 'GET' }, receiptDraftSchema, signal);
    },
    submitReceipt(token: string, confirmed: ConfirmedReceipt, signal?: AbortSignal): Promise<ProgressionResult> {
      const payload = confirmedReceiptSchema.safeParse(confirmed);
      const details = confirmed as Partial<ConfirmedReceipt>;
      const withinSubmitLimits = payload.success && uuidPattern.test(details.draftId ?? '')
        && uuidPattern.test(details.submissionId ?? '')
        && (details.restaurantId === undefined || uuidPattern.test(details.restaurantId))
        && (details.receiptNumber === null || (typeof details.receiptNumber === 'string' && details.receiptNumber.length <= 120))
        && Number.isSafeInteger(details.totalMinor)
        && Array.isArray(details.items)
        && details.items.length <= 100
        && details.items.every((item) => typeof item.originalText === 'string'
          && item.originalText.length <= 240
          && typeof item.confirmedName === 'string' && item.confirmedName.length <= 120
          && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99);
      if (!payload.success || !withinSubmitLimits) {
        throw new ReceiptApiError('Check the restaurant, date, total, currency, and item details before submitting.', 400, 'INVALID_RECEIPT', false);
      }
      return request('/api/receipts/submit', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      }, progressionResultSchema, signal);
    },
  };
}
