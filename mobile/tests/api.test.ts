import { describe, expect, it } from 'vitest';
import { checkBackendHealth, healthUrl } from '../src/lib/api';

describe('backend URL construction', () => {
  it('targets the health route once when the configured URL already has a path or trailing slash', () => {
    expect(healthUrl('https://api.example.test/v1/')).toBe('https://api.example.test/v1/health');
  });

  it('rejects malformed backend configuration instead of issuing a request to a surprising URL', () => {
    expect(() => healthUrl('not a URL')).toThrow('EXPO_PUBLIC_API_URL must be a valid absolute URL');
  });

  it('reports the backend online only after a successful GET returns the health contract', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    const fetcher: typeof fetch = async (input, init) => {
      requestedUrl = String(input);
      requestedMethod = init?.method ?? '';
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    await expect(checkBackendHealth('https://api.example.test/v1', fetcher)).resolves.toEqual({ ok: true });
    expect(requestedUrl).toBe('https://api.example.test/v1/health');
    expect(requestedMethod).toBe('GET');
  });

  it('surfaces a failed health response so the collection can offer a retry', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 503 });
    await expect(checkBackendHealth('https://api.example.test', fetcher)).rejects.toThrow('Backend health check failed (503)');
  });
});
