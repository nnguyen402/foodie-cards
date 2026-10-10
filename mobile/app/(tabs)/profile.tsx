import { ScrollView, StyleSheet, View } from 'react-native';
import { BrandHeader } from '@/components/brand-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

const avatarLabels = { fork: 'Fork', plate: 'Plate', bowl: 'Bowl', noodles: 'Noodles', taco: 'Taco', donut: 'Donut' } as const;

export default function ProfileScreen() {
  const { profile, status, profileError, refreshProfile, signOut, busy } = useAuth();
  if (!profile) {
    return (
      <View style={styles.loading}>
        <MessagePanel title={status === 'loading' ? 'Loading your profile' : 'Profile unavailable'} body={profileError ?? 'Your profile is private to your account.'} kind={status === 'loading' ? 'plain' : 'error'} loading={status === 'loading'} actionLabel={status === 'profile-error' ? 'Retry' : undefined} onAction={() => void refreshProfile()} />
      </View>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="Your account" title="Profile" subtitle="A little more about your food story." />
      <View style={styles.profileCard}>
        <View style={styles.avatar}><AppText variant="heading" strong style={styles.avatarText}>{avatarLabels[profile.avatarKey]}</AppText></View>
        <View style={styles.identity}>
          <AppText variant="heading" strong>{profile.displayName}</AppText>
          {profile.equippedTitleKey ? <AppText variant="small" muted>{profile.equippedTitleKey.replaceAll('_', ' ')}</AppText> : <AppText variant="small" muted>No title equipped yet</AppText>}
        </View>
      </View>
      <View style={styles.levelCard}>
        <AppText variant="small" muted>ACCOUNT LEVEL</AppText>
        <AppText variant="title" strong>Level {profile.accountLevel}</AppText>
        <AppText variant="small">{profile.accountXP} account XP</AppText>
      </View>
      <View style={styles.nextSteps}>
        <AppText variant="heading" strong>Your profile, your pace.</AppText>
        <AppText muted>Restaurant cards, reviews, and favorites will gather here as you build your journal.</AppText>
      </View>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  loading: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  avatar: { minHeight: 68, minWidth: 68, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent },
  identity: { flex: 1, gap: spacing.xs },
  levelCard: { padding: spacing.xl, gap: spacing.sm, borderRadius: radius.card, backgroundColor: colors.surfaceMuted },
  nextSteps: { paddingTop: spacing.sm, gap: spacing.sm },
});
