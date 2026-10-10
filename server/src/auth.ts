import { createClient } from '@supabase/supabase-js';
import { profileSchema, type Profile } from '@foodie-cards/shared';

export type AuthenticatedUser = { userId: string };

export type ServerDependencies = {
  verifyAccessToken: (token: string) => Promise<AuthenticatedUser | null>;
  loadProfile: (userId: string) => Promise<Profile | null>;
};

export function createSupabaseDependencies(
  env: Record<string, string | undefined> = process.env,
): ServerDependencies | undefined {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return undefined;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return {
    async verifyAccessToken(token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        const status = 'status' in error ? error.status : undefined;
        if (status === 401 || status === 403) return null;
        throw error;
      }
      return data.user ? { userId: data.user.id } : null;
    },
    async loadProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_key, account_xp, equipped_title_key')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const parsed = profileSchema.safeParse({
        userId: data.id,
        displayName: data.display_name,
        avatarKey: data.avatar_key,
        accountXP: data.account_xp,
        accountLevel: 1 + Math.floor(data.account_xp / 200),
        equippedTitleKey: data.equipped_title_key,
      });
      if (!parsed.success) throw new Error('Stored profile does not match the public profile contract');
      return parsed.data;
    },
  };
}
