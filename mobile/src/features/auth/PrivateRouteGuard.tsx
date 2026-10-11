import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { useAuth } from '@/providers/auth-provider';
import { colors, spacing } from '@/theme/tokens';
import { privateRouteAction } from './privateRouteAccess';

type Props = PropsWithChildren<{ allowDevelopmentDemo?: boolean }>;

export function PrivateRouteGuard({ children, allowDevelopmentDemo = false }: Props) {
  const { status } = useAuth();
  const action = privateRouteAction(status, { allowDevelopmentDemo, isDevelopment: __DEV__ });

  if (action === 'wait') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Restoring session" />
        <AppText muted>Restoring your journal…</AppText>
      </View>
    );
  }
  if (action === 'sign-in') return <Redirect href="/(auth)/sign-in" />;
  if (action === 'index') return <Redirect href="/" />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
});
