import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAuth } from '@/providers/auth-provider';

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'misconfigured') return <Redirect href="/" />;
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'profile-error') return <Redirect href="/" />;

  return (
    <NativeTabs disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="viewfinder" md="document_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
