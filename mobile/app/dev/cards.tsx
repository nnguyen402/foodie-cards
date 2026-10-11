import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { restaurantStageSchema } from '@foodie-cards/shared';
import { BrandHeader } from '@/components/brand-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { LockedCard } from '@/features/cards/LockedCard';
import { CARD_FIXTURE_LABEL, fixtureCards } from '@/features/cards/fixtures';
import { RestaurantCard } from '@/features/cards/RestaurantCard';
import { stageLabel } from '@/features/cards/stageStyles';
import { colors, radius, spacing } from '@/theme/tokens';

const GRID_CARD_WIDTH = 164;

// Development-only gallery of synthetic cards: every demo theme at every stage.
export default function CardGalleryScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  const largeWidth = Math.min(width - spacing.page * 2, 360);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="Development" title="Card gallery" subtitle="One layout, five themes, three stages." />
      <View style={styles.banner}><AppText variant="small" strong>{CARD_FIXTURE_LABEL}</AppText></View>
      <View style={styles.section}>
        <AppText variant="heading" strong>Play reveal (demo data)</AppText>
        {restaurantStageSchema.options.map((stage) => (
          <Button key={stage} label={stageLabel(stage)} variant="secondary" onPress={() => router.push(`/reveal/demo-${stage}`)} />
        ))}
      </View>
      <View style={styles.section}>
        <AppText variant="heading" strong>Locked card (demo data)</AppText>
        <LockedCard restaurant={fixtureCards('discovered')[0].restaurant} width={largeWidth} style={styles.large} />
      </View>
      {restaurantStageSchema.options.map((stage) => {
        const cards = fixtureCards(stage);
        return (
          <View key={stage} style={styles.section}>
            <AppText variant="heading" strong>{stageLabel(stage)}</AppText>
            <RestaurantCard card={cards[0]} width={largeWidth} style={styles.large} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {cards.map((card) => <RestaurantCard key={card.id} card={card} width={GRID_CARD_WIDTH} />)}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  banner: { padding: spacing.lg, borderRadius: radius.control, backgroundColor: colors.accentSoft },
  section: { gap: spacing.lg },
  large: { alignSelf: 'center' },
  // Room for the Ultra Rare glow, which extends past the card edge.
  row: { gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
});
