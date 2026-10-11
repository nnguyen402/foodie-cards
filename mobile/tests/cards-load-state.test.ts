import { describe, expect, it } from 'vitest';
import { createRequestTracker, shouldStore } from '../src/features/cards/loadState';

type S = { status: 'loading' | 'error' | 'ready' | 'not-found' };
const s = (status: S['status']): S => ({ status });

describe('shouldStore', () => {
  it('rejects a result that is no longer the latest request', () => {
    expect(shouldStore({ isLatest: false, previous: null, incoming: s('ready') })).toBe(false);
    expect(shouldStore({ isLatest: false, previous: s('loading'), incoming: s('error') })).toBe(false);
  });

  it('accepts a latest ready result', () => {
    expect(shouldStore({ isLatest: true, previous: null, incoming: s('ready') })).toBe(true);
    expect(shouldStore({ isLatest: true, previous: s('ready'), incoming: s('ready') })).toBe(true);
  });

  it('accepts a latest error when nothing good is stored', () => {
    expect(shouldStore({ isLatest: true, previous: null, incoming: s('error') })).toBe(true);
    expect(shouldStore({ isLatest: true, previous: s('loading'), incoming: s('error') })).toBe(true);
    expect(shouldStore({ isLatest: true, previous: s('error'), incoming: s('error') })).toBe(true);
  });

  it('rejects a latest error when ready data is stored', () => {
    expect(shouldStore({ isLatest: true, previous: s('ready'), incoming: s('error') })).toBe(false);
  });

  it('accepts not-found over ready because the card is gone', () => {
    expect(shouldStore({ isLatest: true, previous: s('ready'), incoming: s('not-found') })).toBe(true);
  });
});

describe('createRequestTracker', () => {
  it('only the newest request is latest', () => {
    const tracker = createRequestTracker();
    const first = tracker.next();
    expect(tracker.isLatest(first)).toBe(true);
    const second = tracker.next();
    expect(tracker.isLatest(first)).toBe(false);
    expect(tracker.isLatest(second)).toBe(true);
  });

  it('invalidates in-flight requests when the key (user) changes', () => {
    const tracker = createRequestTracker('user-a');
    const token = tracker.next();
    tracker.reset('user-b');
    expect(tracker.isLatest(token)).toBe(false);
    expect(tracker.isLatest(tracker.next())).toBe(true);
  });

  it('keeps in-flight requests when reset is called with the same key', () => {
    const tracker = createRequestTracker('user-a');
    const token = tracker.next();
    tracker.reset('user-a');
    expect(tracker.isLatest(token)).toBe(true);
  });
});
