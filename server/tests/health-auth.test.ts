import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type ServerDependencies } from '../src/app.ts';

const demoProfile = {
  userId: 'user-1', displayName: 'Nora', avatarKey: 'fork' as const,
  accountXP: 0, accountLevel: 1, equippedTitleKey: null,
};

function appWith(overrides: Partial<ServerDependencies> = {}): Express {
  return createApp({
    verifyAccessToken: vi.fn(async (token: string) => token === 'valid-token' ? { userId: 'user-1' } : null),
    loadProfile: vi.fn(async () => demoProfile),
    ...overrides,
  });
}

describe('health and authenticated profile endpoint', () => {
  it('serves health without server credentials', async () => {
    const app = createApp();
    await request(app).get('/health').expect(200, { ok: true });
  });

  it('rejects protected requests without a bearer token', async () => {
    const response = await request(appWith()).get('/api/me').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED', retryable: false });
  });

  it('rejects a token Supabase does not verify', async () => {
    await request(appWith()).get('/api/me').set('Authorization', 'Bearer forged-token').expect(401);
  });

  it('returns only the verified user profile for a valid token', async () => {
    const loadProfile = vi.fn(async () => demoProfile);
    const response = await request(appWith({ loadProfile })).get('/api/me')
      .set('Authorization', 'Bearer valid-token').expect(200);
    expect(response.body).toEqual(demoProfile);
    expect(loadProfile).toHaveBeenCalledOnce();
  });

  it('reports unavailable auth configuration without breaking health', async () => {
    const app = createApp();
    const response = await request(app).get('/api/me').set('Authorization', 'Bearer token').expect(503);
    expect(response.body).toMatchObject({ code: 'CONFIGURATION_ERROR', retryable: false });
    await request(app).get('/health').expect(200, { ok: true });
  });
});
