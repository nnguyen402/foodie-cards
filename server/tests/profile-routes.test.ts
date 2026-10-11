import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

const userId = '30000000-0000-4000-8000-000000000001';
const cardId = '40000000-0000-4000-8000-000000000001';
const profile = { userId, displayName: 'Foodie', avatarKey: 'fork' as const, accountXP: 150, accountLevel: 1, equippedTitleKey: null };
const services = {
  verifyAccessToken: async (token: string) => token === 'valid' ? { userId } : null,
  loadProfile: async () => profile,
  editProfile: async (_user: string, input: { displayName: string; avatarKey: string }) => ({ profile: { ...profile, ...input } }),
  setPins: async (_user: string, input: { pins: { cardId: string; slot: number }[] }) => input,
  equipTitle: async (_user: string, input: { titleKey: string | null }) => ({ equippedTitleKey: input.titleKey }),
};

describe('authenticated profile action routes', () => {
  it('edits only name/avatar and uses verified ownership', async () => {
    let owner = '';
    const app = createApp({ ...services, editProfile: async (user: string, input: { displayName: string; avatarKey: string }) => {
      owner = user;
      return { profile: { ...profile, ...input } };
    } });
    const response = await request(app).patch('/api/me').set('Authorization', 'Bearer valid')
      .send({ displayName: ' Nora ', avatarKey: 'bowl' }).expect(200);
    expect(owner).toBe(userId);
    expect(response.body.profile).toEqual({ ...profile, displayName: 'Nora', avatarKey: 'bowl' });
  });

  it('rejects a forged ownership or XP field', async () => {
    const response = await request(createApp(services)).patch('/api/me').set('Authorization', 'Bearer valid')
      .send({ displayName: 'Nora', avatarKey: 'fork', userId: 'other', accountXP: 1000 }).expect(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
  });

  it('requires authentication for every profile action', async () => {
    const app = createApp(services);
    for (const path of ['/api/me/pins', '/api/me/title']) {
      await request(app).put(path).send({}).expect(401);
    }
    await request(app).patch('/api/me').set('Authorization', 'Bearer forged').send({}).expect(401);
  });

  it('replaces pins using the shared contract and rejects duplicate slots', async () => {
    const app = createApp(services);
    const pins = [{ cardId, slot: 1 }];
    await request(app).put('/api/me/pins').set('Authorization', 'Bearer valid').send({ pins }).expect(200, { pins });
    await request(app).put('/api/me/pins').set('Authorization', 'Bearer valid')
      .send({ pins: [{ cardId, slot: 1 }, { cardId: '40000000-0000-4000-8000-000000000002', slot: 1 }] }).expect(400);
  });

  it('returns a safe error for foreign pins and locked titles', async () => {
    const app = createApp({ ...services,
      setPins: async () => { throw new Error('FORBIDDEN'); },
      equipTitle: async () => { throw new Error('FORBIDDEN'); },
    });
    for (const [path, body] of [
      ['/api/me/pins', { pins: [{ cardId, slot: 1 }] }],
      ['/api/me/title', { titleKey: 'ultra_foodie' }],
    ] as const) {
      const response = await request(app).put(path).set('Authorization', 'Bearer valid').send(body).expect(404);
      expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'The requested item was not found.', retryable: false });
    }
  });

  it('clears an equipped title with explicit null', async () => {
    await request(createApp(services)).put('/api/me/title').set('Authorization', 'Bearer valid')
      .send({ titleKey: null }).expect(200, { equippedTitleKey: null });
  });
});
