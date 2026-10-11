import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReceiptDependencies } from '../src/receipts/store.ts';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const draft = {
  draftId: '11111111-1111-4111-8111-111111111111', restaurantName: 'Busy Bee Cafe', restaurantId: null,
  receiptDate: null, receiptNumber: 'RCPT-42', totalMinor: null, currency: null,
  items: [{ originalText: 'Coffee', suggestedName: 'Coffee', quantity: 1 }],
  warnings: ['Choose a supported restaurant.'],
};
const image = { bytes: Buffer.from('fake-image-bytes'), mimeType: 'image/png' };
const env = {
  SUPABASE_URL: 'https://supabase.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-only',
  GEMINI_API_KEY: 'gemini-test-only',
  GEMINI_MODEL: 'gemini-test-model',
};

function clientWith(options: { insertError?: unknown; insertReject?: boolean; uploadError?: unknown; draftRow?: unknown } = {}) {
  const constraints: Array<[string, unknown]> = [];
  const insert = vi.fn(async (row: unknown) => row);
  const single = vi.fn(async () => {
    if (options.insertReject) throw new Error('database request failed');
    return options.insertError
      ? { data: null, error: options.insertError }
      : { data: { id: draft.draftId }, error: null };
  });
  const maybeSingle = vi.fn(async () => ({ data: options.draftRow ?? null, error: null }));
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { constraints.push([column, value]); return query; }),
    maybeSingle,
    insert: vi.fn((row: unknown) => { insert(row); return { select: vi.fn(() => ({ single })) }; }),
  };
  const storage = {
    upload: vi.fn(async () => options.uploadError ? { data: null, error: options.uploadError } : { data: {}, error: null }),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const supabase = {
    from: vi.fn((table: string) => table === 'receipts' ? query : (() => {
      const catalogQuery = {
        eq: vi.fn(() => catalogQuery),
        order: vi.fn(async () => ({ data: [
          { id: 'restaurant-1', name: 'Busy Bee Cafe', aliases: ['Busy Bee'], location_label: 'Atlanta' },
        ], error: null })),
      };
      return { select: vi.fn(() => catalogQuery) };
    })()),
    storage: { from: vi.fn(() => storage) },
  };
  return { supabase, query, storage, constraints, insert, single, maybeSingle };
}

describe('private receipt draft store', () => {
  beforeEach(() => createClientMock.mockReset());

  it('requires Supabase service credentials before constructing the adapter', () => {
    expect(createReceiptDependencies({ GEMINI_API_KEY: 'test' })).toBeUndefined();
  });

  it('lists supported restaurants with their catalog aliases for matching', async () => {
    const client = clientWith();
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.listRestaurants()).resolves.toEqual([
      { id: 'restaurant-1', name: 'Busy Bee Cafe', aliases: ['Busy Bee'], locationLabel: 'Atlanta' },
    ]);
  });

  it('stores the draft image privately and persists a server SHA-256 with the stable draft ID', async () => {
    const client = clientWith();
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.saveDraft('user-1', image, draft)).resolves.toEqual(draft);

    expect(client.storage.upload).toHaveBeenCalledWith(`user-1/${draft.draftId}.png`, image.bytes, {
      contentType: 'image/png', upsert: false,
    });
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: draft.draftId, user_id: 'user-1', restaurant_id: null, receipt_date: null,
      receipt_number: 'RCPT-42', total_minor: null, currency: null,
      image_path: `user-1/${draft.draftId}.png`,
      image_hash: createHash('sha256').update(image.bytes).digest('hex'), status: 'draft',
      extraction_draft: draft,
    }));
  });

  it('removes the private object when the draft row cannot be inserted', async () => {
    const client = clientWith({ insertError: new Error('database unavailable') });
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.saveDraft('user-1', image, draft)).rejects.toThrow();
    expect(client.storage.remove).toHaveBeenCalledWith([`user-1/${draft.draftId}.png`]);
  });

  it('removes the private object when draft insertion rejects at the network boundary', async () => {
    const client = clientWith({ insertReject: true });
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.saveDraft('user-1', image, draft)).rejects.toThrow();
    expect(client.storage.remove).toHaveBeenCalledWith([`user-1/${draft.draftId}.png`]);
  });

  it('loads only a draft matching both the authenticated owner and draft ID', async () => {
    const client = clientWith({ draftRow: { id: draft.draftId, extraction_draft: draft, status: 'draft' } });
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.loadDraft('user-2', draft.draftId)).resolves.toEqual(draft);
    expect(client.constraints).toEqual([
      ['id', draft.draftId], ['user_id', 'user-2'], ['status', 'draft'],
    ]);
  });

  it('returns no draft when the requested owner has no matching row', async () => {
    const client = clientWith();
    createClientMock.mockReturnValue(client.supabase);
    const dependencies = createReceiptDependencies(env)!;

    await expect(dependencies.loadDraft('user-2', draft.draftId)).resolves.toBeNull();
  });
});
