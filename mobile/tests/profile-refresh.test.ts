import { describe, expect, it } from 'vitest';
import { profileRefreshState, resolveCurrentSession } from '../src/providers/profile-refresh';
import type { Profile } from '@foodie-cards/shared';

const profile: Profile = {
  userId: 'user-a',
  displayName: 'Nina',
  avatarKey: 'bowl',
  accountXP: 200,
  accountLevel: 2,
  equippedTitleKey: null,
};

describe('profile refresh state', () => {
  it('keeps the current same-user profile and signed-in status during refresh', () => {
    expect(profileRefreshState('signed-in', profile, 'user-a')).toEqual({
      profile,
      status: 'signed-in',
    });
  });

  it('keeps initial profile loading in the loading state', () => {
    expect(profileRefreshState('loading', null, 'user-a')).toEqual({
      profile: null,
      status: 'loading',
    });
  });

  it('retries a profile error in the loading state', () => {
    expect(profileRefreshState('profile-error', null, 'user-a')).toEqual({
      profile: null,
      status: 'loading',
    });
  });

  it('never preserves a profile when the session belongs to another user', () => {
    expect(profileRefreshState('signed-in', profile, 'user-b')).toEqual({
      profile: null,
      status: 'loading',
    });
  });
});

describe('refresh session identity', () => {
  it('rejects a delayed refresh callback from an account that has since switched', () => {
    const previousSession = { user: { id: 'user-a' }, accessToken: 'old-a-token' };
    const activeSession = { user: { id: 'user-b' }, accessToken: 'current-b-token' };

    expect(resolveCurrentSession(previousSession, activeSession)).toBeNull();
  });

  it('uses the current session object for a same-user refresh', () => {
    const capturedSession = { user: { id: 'user-a' }, accessToken: 'old-token' };
    const activeSession = { user: { id: 'user-a' }, accessToken: 'refreshed-token' };

    expect(resolveCurrentSession(capturedSession, activeSession)).toBe(activeSession);
  });
});
