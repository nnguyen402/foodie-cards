import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { avatarKeySchema, profileSchema, type Profile } from '@foodie-cards/shared';
import { createSessionScope, type SessionSnapshot } from '@/lib/session-scope';
import { supabase, supabaseConfig } from '@/lib/supabase';
import { profileRefreshState, resolveCurrentSession } from './profile-refresh';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'profile-error' | 'misconfigured';
type SignupDetails = { email: string; password: string; displayName: string; avatarKey: string };

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  busy: boolean;
  authError: string | null;
  profileError: string | null;
  configurationMissing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (details: SignupDetails) => Promise<'signed-in' | 'confirmation-required' | 'failed'>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'misconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const scope = useRef(createSessionScope());
  const activeSession = useRef<Session | null>(null);

  const loadProfile = useCallback(async (nextSession: Session, snapshot: SessionSnapshot, isActive: () => boolean) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_key,account_xp,equipped_title_key')
        .eq('id', nextSession.user.id)
        .single();
      if (error) throw error;

      let row = data;
      const metadata = nextSession.user.user_metadata ?? {};
      const metadataName = typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '';
      const nameToSave = metadataName.length > 0 && metadataName.length <= 40 ? metadataName : null;
      const metadataAvatar = avatarKeySchema.safeParse(metadata.avatar_key);
      if (row.display_name === 'Foodie' && nameToSave) {
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({ display_name: nameToSave, avatar_key: metadataAvatar.success ? metadataAvatar.data : row.avatar_key })
          .eq('id', nextSession.user.id)
          .select('id,display_name,avatar_key,account_xp,equipped_title_key')
          .single();
        if (updateError) throw updateError;
        row = updated;
      }

      const parsed = profileSchema.safeParse({
        userId: row.id,
        displayName: row.display_name,
        avatarKey: row.avatar_key,
        accountXP: row.account_xp,
        accountLevel: 1 + Math.floor(row.account_xp / 200),
        equippedTitleKey: row.equipped_title_key,
      });
      if (!parsed.success) throw new Error('Your profile could not be read. Try again.');
      if (!isActive() || !scope.current.isCurrent(snapshot)) return;
      setProfile(parsed.data);
      setProfileError(null);
      setStatus('signed-in');
    } catch (error) {
      if (!isActive() || !scope.current.isCurrent(snapshot)) return;
      setProfile(null);
      setProfileError(errorMessage(error, 'Your profile could not be loaded. Check your connection and try again.'));
      setStatus('profile-error');
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null, isActive: () => boolean) => {
    const snapshot = scope.current.transitionTo(nextSession?.user.id ?? null);
    activeSession.current = nextSession;
    setSession(nextSession);
    setProfile(null);
    setProfileError(null);
    setStatus(nextSession ? 'loading' : 'signed-out');
    if (nextSession) void loadProfile(nextSession, snapshot, isActive);
  }, [loadProfile]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setStatus('misconfigured');
      return;
    }
    let active = true;
    const isActive = () => active;
    const appStateSubscription = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state === 'active') void client.auth.startAutoRefresh();
          else void client.auth.stopAutoRefresh();
        });
    if (Platform.OS !== 'web' && AppState.currentState === 'active') void client.auth.startAutoRefresh();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession, isActive);
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError('We could not restore your session. Sign in again to continue.');
        applySession(null, isActive);
        return;
      }
      applySession(data.session, isActive);
    }).catch(() => {
      if (!active) return;
      setAuthError('We could not restore your session. Sign in again to continue.');
      applySession(null, isActive);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== 'web') void client.auth.stopAutoRefresh();
      activeSession.current = null;
      scope.current.transitionTo(null);
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    setBusy(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setAuthError(errorMessage(error, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setBusy(false);
    }
  }, []);

  const signUp = useCallback(async ({ email, password, displayName, avatarKey }: SignupDetails) => {
    if (!supabase) return 'failed' as const;
    setBusy(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, avatar_key: avatarKey } },
      });
      if (error) throw error;
      return data.session ? 'signed-in' as const : 'confirmation-required' as const;
    } catch (error) {
      setAuthError(errorMessage(error, 'We could not create your account. Try again.'));
      return 'failed' as const;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    scope.current.transitionTo(null);
    activeSession.current = null;
    setStatus('loading');
    setSession(null);
    setProfile(null);
    setProfileError(null);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setStatus('signed-out');
    } catch (error) {
      setAuthError(errorMessage(error, 'We could not sign you out. Try again.'));
      const { data } = await supabase.auth.getSession();
      applySession(data.session, () => true);
    }
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    const currentSession = resolveCurrentSession(session, activeSession.current);
    if (!currentSession) return;
    const snapshot = scope.current.transitionTo(currentSession.user.id);
    const refreshState = profileRefreshState(status, profile, currentSession.user.id);
    setProfile(refreshState.profile);
    setProfileError(null);
    setStatus(refreshState.status);
    await loadProfile(currentSession, snapshot, () => true);
  }, [loadProfile, profile, session, status]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    profile,
    busy,
    authError,
    profileError,
    configurationMissing: !supabaseConfig,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    clearAuthError: () => setAuthError(null),
  }), [status, session, profile, busy, authError, profileError, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
