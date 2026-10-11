import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

function appWithCorsOrigins(origins: string): Express {
  return createApp(undefined, undefined, origins);
}

describe('browser CORS policy', () => {
  it('answers an allowed authenticated JSON preflight before route authentication', async () => {
    const response = await request(appWithCorsOrigins('http://localhost:8082'))
      .options('/api/receipts/extract')
      .set('Origin', 'http://localhost:8082')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('content-type');
    expect(response.headers.vary).toBe('Origin');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('allows the authenticated JSON PATCH preflight used by review submissions', async () => {
    const response = await request(appWithCorsOrigins('http://localhost:8082'))
      .options('/api/reviews/10000000-0000-4000-8000-000000000001')
      .set('Origin', 'http://localhost:8082')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('content-type');
  });

  it('adds CORS headers to health and authenticated-route errors for an allowed origin', async () => {
    const app = appWithCorsOrigins('http://localhost:8082');
    const health = await request(app).get('/health').set('Origin', 'http://localhost:8082').expect(200);
    const error = await request(app).get('/api/me').set('Origin', 'http://localhost:8082').expect(503);

    expect(health.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(error.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(error.body).toMatchObject({ code: 'CONFIGURATION_ERROR' });
  });

  it('does not grant a CORS origin that is not in the exact allowlist', async () => {
    const response = await request(appWithCorsOrigins('http://localhost:8082'))
      .get('/health')
      .set('Origin', 'http://localhost:8083')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toBe('Origin');
  });

  it('does not approve a preflight from a disallowed origin', async () => {
    const response = await request(appWithCorsOrigins('http://localhost:8082'))
      .options('/api/receipts/extract')
      .set('Origin', 'http://localhost:8083')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(403);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toBe('Origin');
  });

  it('rejects malformed or non-origin allowlist entries at app creation', () => {
    expect(() => appWithCorsOrigins('https://web.example.test/path')).toThrow(/origin/i);
    expect(() => appWithCorsOrigins('*')).toThrow(/origin/i);
    expect(() => appWithCorsOrigins('file://localhost')).toThrow(/origin/i);
  });
});
