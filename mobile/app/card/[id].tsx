import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '@/components/ui/app-text';
import { MessagePanel } from '@/components/ui/message-panel';
import { formatCalendarDate } from '@/features/cards/detail';
import { RestaurantCard } from '@/features/cards/RestaurantCard';
import { RarityLabel, SpinCard } from '@/features/cards/SpinCard';
import { cuisineKeyFor } from '@/features/cards/cuisineArt';
import { abilityLine } from '@/features/map/labels';
import { RarityBackground } from '@/features/cards/RarityBackground';
import { DETAIL_BACKGROUND, nextStageGoal, stageLabel, stageTheme } from '@/features/cards/stageStyles';
import { ratingLabel } from '@/features/cards/themes';
import { useCardDetail } from '@/features/cards/useCardDetail';
import { colors, radius, spacing } from '@/theme/tokens';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="small" strong muted style={styles.sectionTitle}>{title.toUpperCase()}</AppText>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return <View style={[styles.row, last ? undefined : styles.rowDivider]}>{children}</View>;
}

function GoalRow({ label, value, met, last }: { label: string; value: string; met: boolean; last?: boolean }) {
  return (
    <Row last={last}>
      <View accessible accessibilityLabel={`${label} ${value}, ${met ? 'done' : 'not yet'}`} style={styles.split}>
        <View style={styles.goalLabel}>
          <View style={[styles.mark, met ? styles.markDone : undefined]}>
            {met ? <AppText variant="caption" strong style={styles.markText}>✓</AppText> : null}
          </View>
          <AppText>{label}</AppText>
        </View>
        <AppText strong={met} style={styles.tabular}>{value}</AppText>
      </View>
    </Row>
  );
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { state, refresh } = useCardDetail(id ?? '');
  const [spins, setSpins] = useState(0);
  const cardWidth = Math.min(windowWidth - 2 * spacing.page, 360);
  const title = state.status === 'ready' ? state.detail.card.restaurant.name : '';
  const ready = state.status === 'ready';
  const stage = state.status === 'ready' ? state.detail.card.stage : 'discovered';
  const theme = stageTheme(stage);

  let content;
  if (state.status === 'loading') {
    content = <MessagePanel title="Loading card" body="Fetching this restaurant’s card." loading />;
  } else if (state.status === 'error') {
    content = <MessagePanel title="Card unavailable" body={state.message} kind="error" actionLabel="Try again" onAction={() => void refresh()} />;
  } else if (state.status === 'not-found') {
    content = <MessagePanel title="Card not found" body="This card isn’t in your collection." actionLabel="Back to collection" onAction={() => router.replace('/collection')} />;
  } else {
    const { card, visits, dishes, reviewText } = state.detail;
    const goal = nextStageGoal(card.stage);
    const visitText = (count: number) => `${count} ${count === 1 ? 'visit' : 'visits'}`;
    content = (
      <>
        <View style={styles.cardWrap}>
          <SpinCard
            width={cardWidth}
            accessibilityLabel={`${card.restaurant.name}, ${stageLabel(card.stage)} card`}
            accessibilityHint="Turns the card around."
            onSpin={() => setSpins((count) => count + 1)}
          >
            <RestaurantCard card={card} width={cardWidth} />
          </SpinCard>
        </View>
        <View style={styles.rarity}>
          <RarityLabel stage={card.stage} playKey={spins} />
          <AppText variant="small" style={styles.onDarkMuted}>{abilityLine(cuisineKeyFor({ name: card.restaurant.name, cuisine: card.restaurant.category }))}</AppText>
        </View>

        <Section title="Progress">
          {goal ? (
            <>
              <Row><AppText variant="heading" strong>Next: {stageLabel(goal.stage)}</AppText></Row>
              <GoalRow label="XP" value={`${card.cardXP} / ${goal.xp}`} met={card.cardXP >= goal.xp} />
              <GoalRow label="Visits" value={`${card.visitCount} / ${goal.visits}`} met={card.visitCount >= goal.visits} />
              <Row last><AppText variant="small" muted>Both are needed to reach {stageLabel(goal.stage)}.</AppText></Row>
            </>
          ) : (
            <>
              <Row><AppText variant="heading" strong>Highest stage reached</AppText></Row>
              <Row last><AppText muted>{card.cardXP} XP · {visitText(card.visitCount)}</AppText></Row>
            </>
          )}
        </Section>

        <Section title="Visits">
          {visits.length === 0 ? (
            <Row last><AppText muted>No visits recorded yet.</AppText></Row>
          ) : (
            <>
              <Row>
                <View style={styles.split}>
                  <AppText>Last visit</AppText>
                  <AppText strong>{formatCalendarDate(card.lastVisitDate ?? visits[0])}</AppText>
                </View>
              </Row>
              {visits.map((date, index) => (
                <Row key={date} last={index === visits.length - 1}><AppText muted>{formatCalendarDate(date)}</AppText></Row>
              ))}
            </>
          )}
        </Section>

        <Section title="Dishes tried">
          {dishes.length === 0 ? (
            <Row last><AppText muted>No dishes recorded yet.</AppText></Row>
          ) : (
            dishes.map((dish, index) => (
              <Row key={dish.id} last={index === dishes.length - 1}>
                <AppText strong>{dish.name}</AppText>
                <AppText variant="small" muted>First tried {formatCalendarDate(dish.firstPurchaseDate)}</AppText>
              </Row>
            ))
          )}
        </Section>

        {/* The rating/review editor (profile lane) mounts in this section, replacing the read-only rows. */}
        <Section title="Your rating">
          <Row last={reviewText === ''}><AppText strong>{ratingLabel(card.rating)}</AppText></Row>
          {reviewText === '' ? null : <Row last><AppText selectable>{reviewText}</AppText></Row>}
        </Section>
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ready ? DETAIL_BACKGROUND : colors.canvas }]}>
      {/* A loaded card gets the backdrop colour in the header, so no white bar sits over the background. */}
      <Stack.Screen
        options={
          ready
            ? { title, headerStyle: { backgroundColor: DETAIL_BACKGROUND }, headerTintColor: theme.label, headerTitleStyle: { color: theme.label }, headerShadowVisible: false }
            : { title }
        }
      />
      {/* Set from inside the screen: Expo Go cannot change the Info.plist key that a Stack option needs. */}
      {ready ? <StatusBar style="light" /> : null}
      {ready ? <RarityBackground stage={stage} /> : null}
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scroll} contentContainerStyle={styles.content}>
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  cardWrap: { alignItems: 'center' },
  rarity: { alignItems: 'center', gap: 2 },
  onDarkMuted: { color: '#d6cdc2', textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.lg, color: '#d6cdc2' },
  group: { backgroundColor: colors.surface, borderRadius: radius.control, overflow: 'hidden' },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  goalLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: colors.success, borderColor: colors.success },
  markText: { color: colors.white },
  tabular: { fontVariant: ['tabular-nums'] },
});
