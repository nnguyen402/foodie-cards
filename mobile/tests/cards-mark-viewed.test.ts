import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstUnhandled } from '../src/features/cards/reveal/revealEvent';

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: session } }));
import { markRewardViewed } from '../src/features/cards/reveal/markViewed';

function acknowledgement(eventId: string, status = 200) {
  return new Response(JSON.stringify({ eventId, viewedAt: '2026-10-11T05:00:00.000Z' }), { status });
}

describe('saving a completed reveal', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.test');
    session.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('keeps a failed acknowledgement pending and allows retry', async () => {
    const id = crypto.randomUUID();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(acknowledgement(id, 503)).mockResolvedValueOnce(acknowledgement(id)));
    await expect(markRewardViewed(id)).rejects.toThrow();
    expect(firstUnhandled([id])).toBe(id);
    await expect(markRewardViewed(id)).resolves.toBeUndefined();
    expect(firstUnhandled([id])).toBeNull();
  });

  it('does not hide a reveal while its acknowledgement is in flight', async () => {
    const id = crypto.randomUUID();
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((done) => { resolve = done; }));
    const saving = markRewardViewed(id);
    await Promise.resolve();
    expect(firstUnhandled([id])).toBe(id);
    resolve(acknowledgement(id));
    await saving;
    expect(firstUnhandled([id])).toBeNull();
  });

  it('rejects an acknowledgement for another event', async () => {
    const id = crypto.randomUUID();
    vi.stubGlobal('fetch', async () => acknowledgement(crypto.randomUUID()));
    await expect(markRewardViewed(id)).rejects.toThrow();
    expect(firstUnhandled([id])).toBe(id);
  });

  it('rejects malformed success data', async () => {
    const id = crypto.randomUUID();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    await expect(markRewardViewed(id)).rejects.toThrow();
    expect(firstUnhandled([id])).toBe(id);
  });

  it('leaves an event pending when the session expires', async () => {
    const id = crypto.randomUUID();
    session.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(markRewardViewed(id)).rejects.toThrow();
    expect(firstUnhandled([id])).toBe(id);
  });

  it('leaves an event pending after a network failure', async () => {
    const id = crypto.randomUUID();
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    await expect(markRewardViewed(id)).rejects.toThrow();
    expect(firstUnhandled([id])).toBe(id);
  });

  it('makes a stalled acknowledgement retryable instead of saving forever', async () => {
    vi.useFakeTimers();
    const id = crypto.randomUUID();
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));
    let failed = false;
    const saving = markRewardViewed(id).catch(() => { failed = true; });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(failed).toBe(true);
    await saving;
    expect(firstUnhandled([id])).toBe(id);
  });
});
