import type { Profile } from '@foodie-cards/shared';

type RefreshableAuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'profile-error' | 'misconfigured';

type SessionWithUser = { user: { id: string } };

export function resolveCurrentSession<T extends SessionWithUser>(
  capturedSession: T | null,
  activeSession: T | null,
): T | null {
  if (!capturedSession || !activeSession || capturedSession.user.id !== activeSession.user.id) return null;
  return activeSession;
}

export function profileRefreshState(
  status: RefreshableAuthStatus,
  profile: Profile | null,
  sessionUserId: string,
): { profile: Profile | null; status: 'signed-in' | 'loading' } {
  if (sessionUserId && status === 'signed-in' && profile?.userId === sessionUserId) {
    return { profile, status: 'signed-in' };
  }
  return { profile: null, status: 'loading' };
}
