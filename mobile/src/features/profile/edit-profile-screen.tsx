import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { profileEditRequestSchema, type Profile } from '@foodie-cards/shared';
import type { Session } from '@supabase/supabase-js';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { MessagePanel } from '@/components/ui/message-panel';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { PrivateRouteGuard } from '../auth/PrivateRouteGuard';
import { colors, radius, spacing } from '@/theme/tokens';
import { avatarKeys, avatarLabels } from './avatars';
import { profileColumnUpdate } from './save-profile';

export function EditProfileScreen() {
  return <PrivateRouteGuard><EditProfileContent /></PrivateRouteGuard>;
}

function EditProfileContent() {
  const { profile, session, refreshProfile } = useAuth();
  if (!profile || !session) {
    return (
      <View style={styles.centered}>
        <MessagePanel title="Profile unavailable" body="Your account details could not be loaded." kind="error" actionLabel="Retry" onAction={() => void refreshProfile()} />
      </View>
    );
  }
  return <EditProfileForm profile={profile} session={session} />;
}

function EditProfileForm({ profile, session }: { profile: Profile; session: Session }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarKey, setAvatarKey] = useState(profile.avatarKey);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setValidationError(null);
    setSaveError(null);
    const parsed = profileEditRequestSchema.safeParse({ displayName, avatarKey });
    if (!parsed.success) {
      setValidationError('Add a display name using at most 40 characters and choose an avatar.');
      return;
    }
    if (!supabase) {
      setSaveError('Supabase is not configured.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profileColumnUpdate(parsed.data))
        .eq('id', session.user.id);
      if (error) throw error;
      await refreshProfile();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={styles.content}>
      <Button label="Back" variant="quiet" fullWidth={false} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />
      <View style={styles.heading}>
        <AppText variant="title" strong>Edit profile</AppText>
        <AppText muted>Update the name and avatar on your journal. Level, XP, and titles stay tied to what you earn.</AppText>
      </View>
      <FormField
        label="Display name"
        placeholder="How should we greet you?"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={40}
        autoCapitalize="words"
        textContentType="nickname"
      />
      <View style={styles.avatarGroup}>
        <AppText variant="small" strong>Avatar</AppText>
        <View style={styles.avatarList} accessibilityRole="radiogroup" accessibilityLabel="Avatar choices">
          {avatarKeys.map((key) => {
            const selected = avatarKey === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={avatarLabels[key]}
                accessibilityState={{ checked: selected }}
                onPress={() => setAvatarKey(key)}
                style={[styles.avatarChoice, selected ? styles.avatarSelected : undefined]}
              >
                <AppText variant="small" strong={selected} style={selected ? styles.avatarSelectedText : undefined}>{avatarLabels[key]}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {validationError || saveError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <AppText variant="small" style={styles.errorText}>{validationError ?? saveError}</AppText>
        </View>
      ) : null}
      <Button label="Save profile" onPress={() => void save()} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas },
  heading: { gap: spacing.sm },
  avatarGroup: { gap: spacing.sm },
  avatarList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarChoice: { minHeight: 44, minWidth: 76, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  avatarSelectedText: { color: colors.accent },
  errorBox: { backgroundColor: colors.errorSoft, padding: spacing.md, borderRadius: radius.control },
  errorText: { color: colors.error },
});
