// Synthetic end-to-end backend check against local Supabase only.
// Run: node --import tsx scripts/check-backend-integration.mjs
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../server/src/app.ts';
import { createSupabaseDependencies } from '../server/src/auth.ts';

let local;
try {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx supabase status -o json'] : ['supabase', 'status', '-o', 'json'];
  const output = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  local = JSON.parse(output);
} catch {
  throw new Error('Unable to read local Supabase status; start the local stack first.');
}
assert.match(local.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):54321$/);
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const dependencies = createSupabaseDependencies({ SUPABASE_URL: local.API_URL, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY });
const server = createApp(dependencies).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const users = [];
const images = [];
const restaurantId = '10000000-0000-4000-8000-000000000001';

async function api(path, token, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function account() {
  const email = `integration-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null, 'Local synthetic account creation failed');
  users.push(created.data.user.id);
  const client = createClient(local.API_URL, local.ANON_KEY, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null, 'Local synthetic account sign-in failed');
  return { userId: created.data.user.id, token: signed.data.session.access_token };
}

try {
  const owner = await account();
  const other = await account();
  assert.equal((await api('/api/me', 'forged-token')).status, 401, 'Real Auth must reject a forged bearer token');
  const receiptId = randomUUID();
  const image = Buffer.from(`SYNTHETIC LOCAL TEST BYTES ${randomUUID()}`);
  const imagePath = `${owner.userId}/${receiptId}.png`;
  const upload = await admin.storage.from('receipts').upload(imagePath, image, { contentType: 'image/png' });
  assert.equal(upload.error, null, 'Local private test upload failed');
  images.push(imagePath);
  const stored = await admin.from('receipts').insert({
    id: receiptId, user_id: owner.userId, image_path: imagePath,
    image_hash: createHash('sha256').update(image).digest('hex'),
    extraction_draft: { warnings: ['SYNTHETIC TEST; NOT A REAL RECEIPT'] },
  });
  assert.equal(stored.error, null, 'Unresolved owned draft persistence failed');
  const confirmation = { draftId: receiptId, submissionId: randomUUID(), restaurantId,
    receiptDate: '2026-10-10', receiptNumber: randomUUID(), totalMinor: 1000, currency: 'USD',
    items: [{ originalText: 'TEST CHICKEN', confirmedName: 'honey chicken', quantity: 1 }] };
  const foreign = await api('/api/receipts/submit', other.token, 'POST', confirmation);
  assert.equal(foreign.status, 404, 'Foreign draft must not be accepted');
  const first = await api('/api/receipts/submit', owner.token, 'POST', confirmation);
  assert.equal(first.status, 200, 'Real PostgREST receipt acceptance failed: ' + JSON.stringify(first.body));
  assert.equal(first.body.xpBreakdown.totalXP, 140);
  assert.equal(first.body.accountXP, 150);
  assert.deepEqual(first.body.stageAwards, [{ stage: 'discovered', accountXP: 100 }]);
  const replay = await api('/api/receipts/submit', owner.token, 'POST', confirmation);
  assert.deepEqual(replay, first);
  console.log('PASS: real Auth/PostgREST receipt ownership, scoring and immutable replay');

  const review = await api(`/api/reviews/${restaurantId}`, owner.token, 'PATCH', { rating: 0, text: 'Synthetic negative test review' });
  assert.equal(review.status, 200, 'Review RPC/schema failed: ' + JSON.stringify(review.body));
  assert.equal(review.body.accountXP, 200);
  assert.equal(review.body.review.rating, 0);
  const edit = await api(`/api/reviews/${restaurantId}`, owner.token, 'PATCH', { rating: null, text: 'Synthetic edited review' });
  assert.equal(edit.status, 200);
  assert.deepEqual(edit.body.newBadges, []);
  assert.equal(edit.body.accountXP, 200);
  const locked = await api(`/api/reviews/${restaurantId}`, other.token, 'PATCH', { rating: 5, text: 'No owned card' });
  assert.equal(locked.status, 404);
  console.log('PASS: real review RPC preserves zero/null and awards written-review badge once');

  const profile = await api('/api/me', owner.token, 'PATCH', { displayName: ' Integration Tester ', avatarKey: 'bowl' });
  assert.equal(profile.status, 200, 'Profile RPC failed: ' + JSON.stringify(profile.body));
  assert.equal(profile.body.profile.accountXP, 200);
  assert.equal(profile.body.profile.displayName, 'Integration Tester');
  const pins = { pins: [{ cardId: first.body.cardId, slot: 1 }] };
  assert.equal((await api('/api/me/pins', owner.token, 'PUT', pins)).status, 200);
  assert.equal((await api('/api/me/pins', other.token, 'PUT', pins)).status, 404);
  assert.equal((await api('/api/me/title', owner.token, 'PUT', { titleKey: 'ultra_foodie' })).status, 404);
  assert.equal((await api('/api/me/title', owner.token, 'PUT', { titleKey: null })).status, 200);
  console.log('PASS: real profile RPCs protect XP, foreign pins and locked titles');

  const pending = await api('/api/rewards/pending', owner.token);
  assert.equal(pending.status, 200);
  assert.equal(pending.body.rewards.length, 1);
  assert.deepEqual(pending.body.rewards[0].result, first.body);
  assert.deepEqual((await api('/api/rewards/pending', other.token)).body.rewards, []);
  const path = `/api/rewards/${first.body.revealEventId}/viewed`;
  assert.equal((await api(path, other.token, 'POST')).status, 404);
  const viewed = await api(path, owner.token, 'POST');
  assert.equal(viewed.status, 200, 'Reveal RPC/schema failed: ' + JSON.stringify(viewed.body));
  assert.deepEqual(await api(path, owner.token, 'POST'), viewed);
  assert.deepEqual((await api('/api/rewards/pending', owner.token)).body.rewards, []);
  assert.equal((await api('/api/me', owner.token)).body.accountXP, 200);
  console.log('PASS: real reveal recovery and idempotent acknowledgement preserve earned progress');
} finally {
  const failures = [];
  if (images.length) {
    const removed = await admin.storage.from('receipts').remove(images);
    if (removed.error) failures.push('private test image cleanup');
  }
  for (const user of users) {
    const deleted = await admin.auth.admin.deleteUser(user);
    if (deleted.error) failures.push('synthetic account cleanup');
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.deepEqual(failures, [], 'Local test cleanup failed');
}
