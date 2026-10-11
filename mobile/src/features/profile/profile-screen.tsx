import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandHeader } from '@/components/brand-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';
import { avatarLabels } from './avatars';
import type { ProfileAward, ProfilePinSlot } from './board';
import { levelProgress } from './progress';
import { useProfileBoard } from './use-profile-board';

export function ProfileScreen() {
  const router = useRouter();
  const { profile, session, status, profileError, refreshProfile, signOut, busy } = useAuth();
  const userId = session?.user.id ?? '';
  const { state: boardState, refresh } = useProfileBoard(profile ? userId : '', profile?.equippedTitleKey ?? null);

  if (!profile) {
    return (
      <View style={styles.centered}>
        <MessagePanel
          title={status === 'loading' ? 'Loading your profile' : 'Profile unavailable'}
          body={profileError ?? 'Your profile is private to your account.'}
          kind={status === 'loading' ? 'plain' : 'error'}
          loading={status === 'loading'}
          actionLabel={status === 'profile-error' ? 'Retry' : undefined}
          onAction={() => void refreshProfile()}
        />
      </View>
    );
  }

  const progress = levelProgress(profile.accountXP, profile.accountLevel);
  const fill = Math.min(100, (progress.xpIntoLevel / progress.xpPerLevel) * 100);
  const titleName = boardState.status === 'ready'
    ? boardState.board.equippedTitleName ?? (profile.equippedTitleKey ? profile.equippedTitleKey : null)
    : profile.equippedTitleKey;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="Your account" title="Profile" subtitle="The restaurants, titles, and badges that make up your journal." />

      <View style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View style={styles.avatar} accessibilityLabel={`${avatarLabels[profile.avatarKey]} avatar`}>
            <AppText variant="heading" strong style={styles.avatarText}>{avatarLabels[profile.avatarKey]}</AppText>
          </View>
          <View style={styles.identity}>
            <AppText variant="heading" strong>{profile.displayName}</AppText>
            <AppText variant="small" muted>{titleName ?? 'No title equipped yet'}</AppText>
          </View>
        </View>
        <Button label="Edit profile" variant="secondary" onPress={() => router.push('/profile/edit')} />
      </View>

      <View style={styles.levelCard}>
        <AppText variant="small" strong style={styles.eyebrow}>ACCOUNT LEVEL</AppText>
        <AppText variant="title" strong>Level {profile.accountLevel}</AppText>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={`${progress.xpIntoLevel} of ${progress.xpPerLevel} XP toward level ${progress.nextLevel}`}
          accessibilityValue={{ min: 0, max: progress.xpPerLevel, now: progress.xpIntoLevel }}
        >
          <View style={[styles.fill, { width: `${fill}%` }]} />
        </View>
        <AppText variant="small">{progress.xpIntoLevel} / {progress.xpPerLevel} XP toward level {progress.nextLevel}</AppText>
        <AppText variant="caption" muted>{profile.accountXP} account XP in total</AppText>
      </View>

      {boardState.status === 'loading' ? (
        <MessagePanel title="Loading your journal" body="Pins, badges, and titles stay private to your account." loading />
      ) : null}
      {boardState.status === 'error' ? (
        <MessagePanel title="Some profile details did not load" body={boardState.message} kind="error" actionLabel="Try again" onAction={() => void refresh()} />
      ) : null}
      {boardState.status === 'ready' ? (
        <>
          <PinSection pins={boardState.board.pins} />
          <AwardSection title="Badges" empty="Badges appear here after you earn them." awards={boardState.board.badges} />
          <AwardSection
            title="Titles"
            empty="Titles you unlock will appear here."
            awards={boardState.board.titles}
            equippedKey={profile.equippedTitleKey}
          />
        </>
      ) : null}

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} loading={busy} />
    </ScrollView>
  );
}

function PinSection({ pins }: { pins: ProfilePinSlot[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" strong>Pinned restaurants</AppText>
      <View style={styles.pinRow}>
        {pins.map((pin) => (
          <View key={pin.slot} style={[styles.pinSlot, pin.cardId ? styles.pinFilled : undefined]} accessibilityLabel={pinLabel(pin)}>
            <AppText variant="caption" strong style={styles.eyebrow}>SLOT {pin.slot}</AppText>
            {pin.unavailable ? <AppText variant="small" strong>Card unavailable</AppText> : null}
            {!pin.cardId ? <AppText variant="small" muted>Empty</AppText> : null}
            {pin.restaurantName ? <AppText variant="small" strong numberOfLines={3}>{pin.restaurantName}</AppText> : null}
            {pin.stageLabel ? <AppText variant="caption" muted>{pin.stageLabel}</AppText> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function pinLabel(pin: ProfilePinSlot): string {
  if (pin.unavailable) return `Pin slot ${pin.slot}, card unavailable`;
  if (!pin.cardId) return `Pin slot ${pin.slot}, empty`;
  return `Pin slot ${pin.slot}, ${pin.restaurantName ?? 'restaurant'}${pin.stageLabel ? `, ${pin.stageLabel}` : ''}`;
}

function AwardSection({ title, empty, awards, equippedKey }: { title: string; empty: string; awards: ProfileAward[]; equippedKey?: string | null }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText variant="heading" strong>{title}</AppText>
        <AppText variant="small" muted>{awards.length}</AppText>
      </View>
      {awards.length === 0 ? <AppText muted>{empty}</AppText> : (
        <View style={styles.awardList}>
          {awards.map((award) => {
            const equipped = equippedKey != null && award.key === equippedKey;
            return (
              <View key={award.key} style={styles.award}>
                <View style={styles.awardHeading}>
                  <AppText strong>{award.name}</AppText>
                  {equipped ? <AppText variant="caption" strong style={styles.equipped}>Equipped</AppText> : null}
                </View>
                {award.description ? <AppText variant="small" muted>{award.description}</AppText> : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas },
  identityCard: { padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { minHeight: 76, minWidth: 76, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent },
  identity: { flex: 1, gap: spacing.xs },
  levelCard: { padding: spacing.xl, gap: spacing.sm, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  eyebrow: { letterSpacing: 1.1, color: colors.accent },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: spacing.sm },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinRow: { flexDirection: 'row', gap: spacing.sm },
  pinSlot: { flex: 1, minHeight: 132, padding: spacing.md, gap: spacing.xs, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  pinFilled: { borderStyle: 'solid', backgroundColor: colors.surface, borderColor: colors.border },
  awardList: { gap: spacing.sm },
  award: { padding: spacing.lg, gap: spacing.xs, borderRadius: radius.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  awardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  equipped: { color: colors.accent },
});
