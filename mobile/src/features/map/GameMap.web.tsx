import { View } from 'react-native';
import { MessagePanel } from '@/components/ui/message-panel';
import { colors, spacing } from '@/theme/tokens';

// react-native-maps has no web build, so the web export shows a pointer to the phone app instead.
export function GameMap() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas }}>
      <MessagePanel title="The map lives in the phone app" body="Open Foodie Cards on your phone to explore restaurants around you." />
    </View>
  );
}
