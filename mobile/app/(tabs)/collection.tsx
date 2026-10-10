import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { MessagePanel } from '@/components/ui/message-panel';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/brand-header';
import { checkBackendHealth, type HealthResponse } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

type CardSummary = {
  id: string;
  card_xp: number;
  stage: string;
  visit_count: number;
  last_visit_date: string | null;
  restaurants: { name: string; location_label: string } | null;
};
type CollectionState = { userId: string; cards: CardSummary[] } | null;

export default function CollectionScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [collectionState, setCollectionState] = useState<CollectionState>(null);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [healthError, setHealthError] = useState<string | null>(null);
  const currentCards = collectionState?.userId === userId ? collectionState.cards : null;

  const loadCollection = useCallback(async () => {
    if (!supabase || !userId) return;
    setCollectionLoading(true);
    setCollectionError(null);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id,card_xp,stage,visit_count,last_visit_date,restaurants(name,location_label)')
        .eq('user_id', userId)
        .order('last_visit_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const cards = (data ?? []) as unknown as CardSummary[];
      setCollectionState({ userId, cards });
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : 'Your collection could not be loaded.');
    } finally {
      setCollectionLoading(false);
    }
  }, [userId]);

  const checkHealth = useCallback(async () => {
    setHealth('checking');
    setHealthError(null);
    try {
      await checkBackendHealth(process.env.EXPO_PUBLIC_API_URL ?? '');
      setHealth('online');
    } catch (error) {
      setHealth('offline');
      setHealthError(error instanceof Error ? error.message : 'Backend is not reachable.');
    }
  }, []);

  useEffect(() => { void loadCollection(); }, [loadCollection]);
  useEffect(() => { void checkHealth(); }, [checkHealth]);

  const collectionContent = useMemo(() => {
    if (collectionLoading) {
      return <MessagePanel title="Loading your collection" body="Your cards stay private to your account." loading />;
    }
    if (collectionError) {
      return <MessagePanel title="Collection unavailable" body={collectionError} kind="error" actionLabel="Try again" onAction={() => void loadCollection()} />;
    }
    if (currentCards === null) {
      return <MessagePanel title="Loading your collection" body="Your cards stay private to your account." loading />;
    }
    if (currentCards.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyStamp}><AppText variant="title" strong style={styles.emptyMark}>01</AppText></View>
          <AppText variant="heading" strong>Your first card starts here.</AppText>
          <AppText muted>When you scan and confirm a restaurant receipt, your first visit will appear in this collection.</AppText>
        </View>
      );
    }
    return currentCards.map((card) => (
      <View key={card.id} style={styles.card}>
        <AppText variant="heading" strong>{card.restaurants?.name ?? 'Restaurant'}</AppText>
        <AppText muted>{card.restaurants?.location_label ?? ''}</AppText>
        <AppText variant="small">{card.stage.replace('_', ' ')} · {card.card_xp} XP · {card.visit_count} {card.visit_count === 1 ? 'visit' : 'visits'}</AppText>
      </View>
    ));
  }, [collectionLoading, currentCards, collectionError, loadCollection]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="Your food journal" title="Collection" subtitle="Places you’ve made part of your story." />
      <View style={styles.health}>
        <View style={[styles.healthDot, health === 'online' ? styles.dotOnline : health === 'offline' ? styles.dotOffline : undefined]} />
        <View style={styles.healthText}>
          <AppText variant="small" strong>{health === 'online' ? 'Backend connected' : health === 'checking' ? 'Checking backend…' : 'Backend unavailable'}</AppText>
          {health === 'offline' ? <AppText variant="caption" muted>{healthError}</AppText> : null}
        </View>
        {health === 'offline' ? <Button label="Retry" variant="quiet" fullWidth={false} onPress={() => void checkHealth()} /> : null}
      </View>
      <View style={styles.sectionHeading}><AppText variant="heading" strong>Your cards</AppText><AppText variant="small" muted>{currentCards?.length ?? ''}</AppText></View>
      <View style={styles.cardList}>{collectionContent}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  health: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface },
  healthDot: { height: 9, width: 9, borderRadius: 6, backgroundColor: colors.inkMuted },
  dotOnline: { backgroundColor: colors.success },
  dotOffline: { backgroundColor: colors.error },
  healthText: { flex: 1, gap: spacing.xs },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardList: { gap: spacing.md },
  card: { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  empty: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  emptyStamp: { height: 52, width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accentSoft },
  emptyMark: { color: colors.accent },
});
