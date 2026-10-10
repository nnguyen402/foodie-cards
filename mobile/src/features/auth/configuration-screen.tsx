import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { colors, spacing } from '@/theme/tokens';

export function ConfigurationScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.brandMark}><AppText strong style={styles.brandLetters}>FC</AppText></View>
      <AppText variant="display" strong>Almost ready.</AppText>
      <AppText muted>Foodie Cards needs its public Supabase connection before you can create an account or sign in.</AppText>
      <View style={styles.variables}>
        <AppText variant="small" strong>Set these mobile environment variables:</AppText>
        <AppText variant="small" selectable>EXPO_PUBLIC_SUPABASE_URL</AppText>
        <AppText variant="small" selectable>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</AppText>
      </View>
      <AppText variant="small" muted>Only the project URL and publishable key belong in the app. Privileged keys stay on the server.</AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.page, gap: spacing.lg, backgroundColor: colors.canvas },
  brandMark: { height: 52, width: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  brandLetters: { color: colors.accent, fontSize: 20 },
  variables: { padding: spacing.lg, gap: spacing.sm, borderRadius: 18, backgroundColor: colors.surfaceMuted },
});
