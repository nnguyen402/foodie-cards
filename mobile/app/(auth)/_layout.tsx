import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'misconfigured') return <Redirect href="/" />;
  if (status === 'loading') return null;
  if (status === 'signed-in' || status === 'profile-error') return <Redirect href="/(tabs)/collection" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'default' }} />;
}
