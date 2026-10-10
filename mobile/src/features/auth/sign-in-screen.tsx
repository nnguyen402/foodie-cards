import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { colors, radius, spacing, type as typeScale } from '@/theme/tokens';
import { useAuth } from '@/providers/auth-provider';

const avatars = [
  { key: 'fork', label: 'Fork' },
  { key: 'plate', label: 'Plate' },
  { key: 'bowl', label: 'Bowl' },
  { key: 'noodles', label: 'Noodles' },
  { key: 'taco', label: 'Taco' },
  { key: 'donut', label: 'Donut' },
] as const;

export function SignInScreen() {
  const { signIn, signUp, busy, authError, clearAuthError } = useAuth();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarKey, setAvatarKey] = useState<(typeof avatars)[number]['key']>('fork');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function changeMode(next: boolean) {
    setCreatingAccount(next);
    setValidationError(null);
    clearAuthError();
  }

  async function submit() {
    clearAuthError();
    setValidationError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (creatingAccount && !displayName.trim()) {
      setValidationError('Add a display name to create your account.');
      return;
    }
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Use a password with at least 8 characters.');
      return;
    }

    if (creatingAccount) {
      const result = await signUp({ email: normalizedEmail, password, displayName: displayName.trim(), avatarKey });
      if (result === 'confirmation-required') setValidationError('Check your email to confirm your account, then sign in here.');
    } else {
      await signIn(normalizedEmail, password);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.brand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.brandMark}><AppText strong style={styles.brandLetters}>FC</AppText></View>
          <AppText variant="small" strong style={styles.brandName}>FOODIE CARDS</AppText>
        </View>

        <View style={styles.headingBlock}>
          <AppText variant="display" strong>{creatingAccount ? 'Make it yours.' : 'Good food, remembered.'}</AppText>
          <AppText muted>{creatingAccount ? 'Create a private journal for the places and dishes you love.' : 'Sign in to pick up where your food story left off.'}</AppText>
        </View>

        {creatingAccount ? (
          <>
            <FormField
              label="Display name"
              placeholder="How should we greet you?"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={40}
              autoCapitalize="words"
              textContentType="nickname"
              returnKeyType="next"
            />
            <View style={styles.avatarGroup}>
              <AppText variant="small" strong>Choose an avatar</AppText>
              <View style={styles.avatarList} accessibilityRole="radiogroup" accessibilityLabel="Avatar choices">
                {avatars.map((avatar) => {
                  const selected = avatarKey === avatar.key;
                  return (
                    <Pressable
                      key={avatar.key}
                      accessibilityRole="radio"
                      accessibilityLabel={avatar.label}
                      accessibilityState={{ checked: selected }}
                      onPress={() => setAvatarKey(avatar.key)}
                      style={[styles.avatarChoice, selected ? styles.avatarSelected : undefined]}
                    >
                      <AppText variant="small" strong={selected} style={selected ? styles.avatarSelectedText : undefined}>{avatar.label}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <FormField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          returnKeyType="next"
        />
        <FormField
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType={creatingAccount ? 'newPassword' : 'password'}
          autoComplete={creatingAccount ? 'new-password' : 'current-password'}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />

        {validationError || authError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <AppText variant="small" style={styles.errorText}>{validationError ?? authError}</AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label={creatingAccount ? 'Create account' : 'Sign in'} onPress={() => void submit()} loading={busy} />
          <Pressable
            accessibilityRole="button"
            onPress={() => changeMode(!creatingAccount)}
            hitSlop={8}
            style={styles.modeSwitch}
          >
            <AppText variant="small" muted>{creatingAccount ? 'Already have an account?' : 'New to Foodie Cards?'}</AppText>
            <AppText variant="small" strong style={styles.modeLink}>{creatingAccount ? 'Sign in' : 'Create account'}</AppText>
          </Pressable>
        </View>
        <AppText variant="caption" muted style={styles.privacyNote}>Your collection is private to your account.</AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandMark: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  brandLetters: { color: colors.accent, fontSize: 18 },
  brandName: { letterSpacing: 1.4, color: colors.inkMuted },
  headingBlock: { gap: spacing.sm, paddingTop: spacing.md },
  avatarGroup: { gap: spacing.sm },
  avatarList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarChoice: { minHeight: 44, minWidth: 76, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  avatarSelectedText: { color: colors.accent },
  actions: { gap: spacing.md, paddingTop: spacing.sm },
  modeSwitch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  modeLink: { color: colors.accent },
  errorBox: { backgroundColor: colors.errorSoft, padding: spacing.md, borderRadius: radius.control },
  errorText: { color: colors.error },
  privacyNote: { textAlign: 'center' },
});
