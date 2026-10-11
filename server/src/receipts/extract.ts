import { randomUUID } from 'node:crypto';
import { receiptDraftSchema, type ReceiptDraft } from '@foodie-cards/shared';
import { z } from 'zod';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const GEMINI_TIMEOUT_MS = 30_000;

const candidateSchema = z.object({
  restaurantName: z.string().nullable(),
  receiptDate: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  totalMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  items: z.array(z.object({
    originalText: z.string().trim().min(1),
    suggestedName: z.string().trim().min(1),
    quantity: z.number().int().positive().nullable(),
    kind: z.enum(['food', 'non_food']),
    confidence: z.enum(['certain', 'uncertain']),
  })),
});

const responseSchema = {
  type: 'OBJECT',
  properties: {
    restaurantName: { type: 'STRING', nullable: true },
    receiptDate: { type: 'STRING', nullable: true },
    receiptNumber: { type: 'STRING', nullable: true },
    totalMinor: { type: 'INTEGER', nullable: true },
    currency: { type: 'STRING', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          originalText: { type: 'STRING' },
          suggestedName: { type: 'STRING' },
          quantity: { type: 'INTEGER', nullable: true },
          kind: { type: 'STRING', enum: ['food', 'non_food'] },
          confidence: { type: 'STRING', enum: ['certain', 'uncertain'] },
        },
        required: ['originalText', 'suggestedName', 'quantity', 'kind', 'confidence'],
      },
    },
  },
  required: ['restaurantName', 'receiptDate', 'receiptNumber', 'totalMinor', 'currency', 'items'],
};

export type ReceiptImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ReceiptExtractionOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  restaurants?: Array<{ id: string; name: string; aliases: string[] }>;
};

class RetryableGeminiError extends Error {}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function buildPrompt(): string {
  return [
    'Read this receipt and return only facts clearly visible on it.',
    'Copy each purchased food or drink line verbatim into originalText.',
    'Keep translations and modifiers with the purchased item; do not treat them as separate items.',
    'Exclude tax, tips, service fees, discounts, payment lines, and other non-item lines from food items.',
    'Do not invent a dish name, quantity, restaurant, date, total, or receipt number.',
    'Use null for an unreadable or absent field and for an unspecified quantity; unspecified quantity will be treated as one.',
    'Set kind to non_food for non-item lines. Mark a name uncertain rather than guessing when the text is unclear.',
    'Use YYYY-MM-DD for receiptDate and ISO 4217 uppercase currency codes.',
    'Return totalMinor as integer minor currency units, such as cents for USD.',
  ].join(' ');
}

function normalizeRestaurantName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function resolveRestaurantId(
  name: string | null,
  restaurants: ReceiptExtractionOptions['restaurants'],
): string | null {
  if (!name || !restaurants?.length) return null;
  const normalizedName = normalizeRestaurantName(name);
  if (!normalizedName) return null;
  const matchingIds = new Set(restaurants
    .filter((restaurant) => [restaurant.name, ...restaurant.aliases]
      .some((entry) => normalizeRestaurantName(entry) === normalizedName))
    .map((restaurant) => restaurant.id));
  return matchingIds.size === 1 ? [...matchingIds][0] : null;
}

async function requestGemini(
  url: string,
  body: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch {
    throw new RetryableGeminiError('Gemini request failed or timed out.');
  }

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new RetryableGeminiError(`Gemini temporarily returned HTTP ${response.status}.`);
    }
    throw new Error(`Gemini rejected the extraction request (HTTP ${response.status}).`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Gemini returned an unreadable response.');
  }
}

export async function extractReceipt(
  image: ReceiptImage,
  options: ReceiptExtractionOptions = {},
): Promise<ReceiptDraft> {
  const env = options.env ?? process.env;
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL;
  if (!apiKey || !model) {
    throw new Error('Receipt extraction requires GEMINI_API_KEY and GEMINI_MODEL server configuration.');
  }
  if (!SUPPORTED_MIME_TYPES.some((mimeType) => mimeType === image.mimeType)) {
    throw new Error('Receipt image must be JPEG, PNG, or WebP.');
  }
  if (image.bytes.byteLength === 0 || image.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Receipt image must be larger than zero bytes and no larger than 10 MB.');
  }

  const supportsThinkingLevel = /^gemini-3(?:\.\d+)?-flash(?:-(?:preview|exp|latest))?$/i.test(model);
  const thinkingLevel = env.GEMINI_THINKING_LEVEL ?? 'low';
  if (supportsThinkingLevel && !['low', 'medium', 'high'].includes(thinkingLevel)) {
    throw new Error('GEMINI_THINKING_LEVEL must be low, medium, or high for Gemini 3 Flash models.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema,
  };
  if (supportsThinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel };
  }
  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: buildPrompt() },
        {
          inlineData: {
            mimeType: image.mimeType,
            data: Buffer.from(image.bytes).toString('base64'),
          },
        },
      ],
    }],
    generationConfig,
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  let responseBody: unknown;
  let completed = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      responseBody = await requestGemini(url, body, fetchImpl);
      completed = true;
      break;
    } catch (error) {
      if (!(error instanceof RetryableGeminiError) || attempt === 1) throw error;
    }
  }
  if (!completed) throw new Error('Gemini receipt extraction did not complete.');

  const text = z.object({
    candidates: z.array(z.object({
      content: z.object({ parts: z.array(z.object({ text: z.string() })) }),
    })).min(1),
  }).parse(responseBody).candidates[0].content.parts.find((part) => part.text)?.text;
  if (!text) throw new Error('Gemini returned no structured receipt data.');

  let candidate: z.infer<typeof candidateSchema>;
  try {
    candidate = candidateSchema.parse(JSON.parse(text));
  } catch {
    throw new Error('Gemini receipt data did not match the required structure.');
  }

  const warnings: string[] = [];
  const restaurantName = candidate.restaurantName?.trim() || null;
  const restaurantId = resolveRestaurantId(restaurantName, options.restaurants);
  const receiptDate = candidate.receiptDate && isCalendarDate(candidate.receiptDate)
    ? candidate.receiptDate
    : null;
  if (!restaurantId) warnings.push('Choose a supported restaurant before confirming this receipt.');
  if (!receiptDate) warnings.push('Receipt date is missing or unreadable; check the image before confirming.');
  const currency = candidate.currency && /^[A-Z]{3}$/.test(candidate.currency) ? candidate.currency : null;
  if (candidate.currency && !currency) warnings.push('Currency is unreadable; check the image before confirming.');
  const items = candidate.items
    .filter((item) => item.kind === 'food')
    .map((item) => {
      if (item.confidence === 'uncertain') warnings.push(`Review uncertain item: "${item.originalText}".`);
      return {
        originalText: item.originalText,
        suggestedName: item.confidence === 'uncertain' ? item.originalText : item.suggestedName,
        quantity: item.quantity ?? 1,
      };
    });
  if (items.length === 0) warnings.push('No readable food or drink items were found; try a clearer image.');

  return receiptDraftSchema.parse({
    draftId: randomUUID(),
    restaurantId,
    restaurantName,
    receiptDate,
    receiptNumber: candidate.receiptNumber,
    totalMinor: candidate.totalMinor,
    currency,
    items,
    warnings,
  });
}
