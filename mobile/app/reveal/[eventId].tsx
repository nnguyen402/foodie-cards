import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { PrivateRouteGuard } from '@/features/auth/PrivateRouteGuard';
import { CARD_FIXTURE_LABEL } from '@/features/cards/fixtures';
import { RevealSequence } from '@/features/cards/reveal/RevealSequence';
import { markRewardViewed } from '@/features/cards/reveal/markViewed';
import { useRevealEvent } from '@/features/cards/reveal/useRevealEvent';
import { isDemoEventId } from '@/features/cards/reveal/revealEvent';
import { spacing } from '@/theme/tokens';

const THEATRE = '#120e0b';

export default function RevealScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const id = eventId ?? '';
  return (
    <PrivateRouteGuard allowDevelopmentDemo={isDemoEventId(id)}>
      <RevealContent key={id} id={id} />
    </PrivateRouteGuard>
  );
}

function RevealContent({ id }: { id: string }) {
  const router = useRouter();
  const { state, retry } = useRevealEvent(id);
  const [viewedStatus, setViewedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [viewedError, setViewedError] = useState<string>();
  const saving = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const saveViewed = useCallback(async () => {
    if (saving.current || viewedStatus === 'saved') return;
    saving.current = true;
    setViewedStatus('saving');
    setViewedError(undefined);
    try {
      await markRewardViewed(id);
      if (active.current) setViewedStatus('saved');
    } catch (error) {
      if (active.current) {
        setViewedStatus('error');
        setViewedError(error instanceof Error ? error.message : 'The reveal could not be saved. Retry or return later.');
      }
    } finally {
      saving.current = false;
    }
  }, [id, viewedStatus]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (state.status === 'ready') {
    return (
      <RevealSequence
        card={state.card}
        previousStage={state.previousStage}
        demoLabel={state.demo ? CARD_FIXTURE_LABEL : undefined}
        onViewed={() => { if (!state.demo) void saveViewed(); }}
        onClose={close}
        viewedStatus={viewedStatus}
        viewedError={viewedError}
        onRetryViewed={() => void saveViewed()}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {state.status === 'loading' ? (
        <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading reveal" />
      ) : (
        <View style={styles.panel}>
          <MessagePanel
            kind={state.status === 'error' ? 'error' : 'plain'}
            title={state.status === 'error' ? 'Reveal unavailable' : 'Reveal not found'}
            body={state.status === 'error' ? state.message : 'This reveal isn’t available.'}
            actionLabel={state.status === 'error' ? 'Retry' : undefined}
            onAction={state.status === 'error' ? () => void retry() : undefined}
          />
          <Button label="Close" variant="secondary" onPress={close} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEATRE, alignItems: 'center', justifyContent: 'center', padding: spacing.page },
  panel: { width: '100%', gap: spacing.md },
});
