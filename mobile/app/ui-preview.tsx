import { useState } from 'react';
import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/ui/reusables/button';
import { Input } from '@/components/ui/reusables/input';
import { Text } from '@/components/ui/reusables/text';

export default function UiPreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <UiPreview />;
}

function UiPreview() {
  const [value, setValue] = useState('Sunday market salad');
  const [lastAction, setLastAction] = useState('');
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 p-6"
    >
      <View className="gap-2">
        <Text variant="large">Shared controls</Text>
        <Text variant="muted">Development preview for the new React Native Reusables setup.</Text>
      </View>

      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        <Text variant="h4">Button variants</Text>
        <Button accessibilityLabel="Primary button preview" onPress={() => setLastAction('Primary button pressed')}><Text>Primary</Text></Button>
        <Button variant="secondary" accessibilityLabel="Secondary button preview" onPress={() => setLastAction('Secondary button pressed')}><Text>Secondary</Text></Button>
        <Button variant="outline" accessibilityLabel="Outline button preview" onPress={() => setLastAction('Outline button pressed')}><Text>Outline</Text></Button>
        <Button variant="destructive" accessibilityLabel="Destructive button preview" onPress={() => setLastAction('Destructive button pressed')}><Text>Destructive</Text></Button>
        <Button variant="ghost" accessibilityLabel="Ghost button preview" onPress={() => setLastAction('Ghost button pressed')}><Text>Ghost</Text></Button>
        <Button variant="link" accessibilityLabel="Link button preview" onPress={() => setLastAction('Link button pressed')}><Text>Link</Text></Button>
        <Button loading accessibilityLabel="Saving recipe preview"><Text>Saving recipe</Text></Button>
        <Button disabled accessibilityLabel="Disabled button preview"><Text>Unavailable</Text></Button>
        <Button variant="outline" onPress={() => setLastAction('Long label pressed')}><Text>A longer button label that can wrap when your system text size grows</Text></Button>
        {lastAction ? <Text accessibilityLiveRegion="polite" variant="muted">{lastAction}</Text> : null}
      </View>

      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        <Text variant="h4">Input and text</Text>
        <Text nativeID="recipe-name-label" variant="small">Recipe name</Text>
        <Input
          accessibilityLabel="Recipe name"
          value={value}
          onChangeText={setValue}
          placeholder="Type a recipe name"
          returnKeyType="done"
        />
        <Text variant="muted">Current value: {value || 'Empty'}</Text>
        <Text>
          This longer paragraph checks wrapping and Dynamic Type. The text uses the shared foreground color and should remain readable as the system text size grows, while the input and buttons keep enough height for touch.
        </Text>
      </View>

      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        <Text variant="h4">Color scheme</Text>
        <Text variant="muted">Current: {colorScheme ?? 'system'}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => setColorScheme('system')}><Text>System</Text></Button>
          <Button size="sm" variant="outline" onPress={() => setColorScheme('light')}><Text>Light</Text></Button>
          <Button size="sm" variant="outline" onPress={() => setColorScheme('dark')}><Text>Dark</Text></Button>
        </View>
      </View>
    </ScrollView>
  );
}
