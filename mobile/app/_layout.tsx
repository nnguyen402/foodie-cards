import '../global.css';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { PortalHost } from '@rn-primitives/portal';
import { useColorScheme, vars } from 'nativewind';
import { AuthProvider } from '@/providers/auth-provider';
import { colors } from '@/theme/tokens';
import { getThemeCssVariables } from '@/lib/theme';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const content = (
    <View className="flex-1 bg-background" style={vars(getThemeCssVariables(colorScheme))}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ui-preview" options={{ headerShown: true, title: 'Shared controls' }} />
        <Stack.Screen name="card/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Collection' }} />
        <Stack.Screen name="reveal/[eventId]" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      <PortalHost />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <AuthProvider>{content}</AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
