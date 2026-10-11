import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { MessagePanel } from '@/components/ui/message-panel';
import { ConfigurationScreen } from '@/features/auth/configuration-screen';
import { useAuth } from '@/providers/auth-provider';
import { colors, spacing } from '@/theme/tokens';

export default function IndexRoute() {
  const { status, profileError, refreshProfile } = useAuth();
  if (status === 'misconfigured') return <ConfigurationScreen />;
  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <AppText muted>Restoring your journal…</AppText>
      </View>
    );
  }
  if (status === 'profile-error') {
    return (
      <View style={styles.error}>
        <MessagePanel title="Your profile did not load" body={profileError ?? 'Check your connection and try again.'} kind="error" actionLabel="Retry" onAction={() => void refreshProfile()} />
      </View>
    );
  }
  return <Redirect href={status === 'signed-in' ? '/(tabs)/map' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  error: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas },
});
