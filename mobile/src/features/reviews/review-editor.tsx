import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewRequest, ReviewResponse } from '@foodie-cards/shared';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { MessagePanel } from '@/components/ui/message-panel';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';
import { submitReview } from './api';
import { loadExistingReview } from './load-review';
import {
  createReviewDraft,
  reviewPayload,
  reviewValidationMessage,
  updateDraftRating,
  type ReviewDraft,
} from './model';
import { RatingInput } from './rating-input';

type ReviewEditorProps = {
  restaurantId: string;
  onSaved?: (response: ReviewResponse) => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-owned' }
  | { status: 'ready'; review: ReviewDraft };

export function ReviewEditor({ restaurantId, onSaved }: ReviewEditorProps) {
  const { session, refreshProfile } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id ?? '';

  useEffect(() => {
    let active = true;
    if (!userId) {
      setLoadState({ status: 'error', message: 'Sign in to rate this restaurant.' });
      return () => { active = false; };
    }
    if (!restaurantId) {
      setLoadState({ status: 'error', message: 'This restaurant could not be identified.' });
      return () => { active = false; };
    }

    setLoadState({ status: 'loading' });
    void loadExistingReview(userId, restaurantId)
      .then((result) => {
        if (!active) return;
        setLoadState(
          result.ownsCard
            ? { status: 'ready', review: result.review }
            : { status: 'not-owned' },
        );
      })
      .catch((error) => {
        if (!active) return;
        setLoadState({
          status: 'error',
          message: error instanceof Error && error.message
            ? error.message
            : 'Your review could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [attempt, restaurantId, userId]);

  if (loadState.status === 'loading') {
    return (
      <MessagePanel
        title="Loading your review"
        body="Checking your card and saved rating."
        loading
      />
    );
  }
  if (loadState.status === 'error') {
    return (
      <MessagePanel
        title="Review unavailable"
        body={loadState.message}
        kind="error"
        actionLabel={userId && restaurantId ? 'Try again' : undefined}
        onAction={userId && restaurantId ? () => setAttempt((value) => value + 1) : undefined}
      />
    );
  }
  if (loadState.status === 'not-owned') {
    return (
      <MessagePanel
        title="Unlock this card to review"
        body="A restaurant can be rated after one of its receipts earns the card."
      />
    );
  }

  return (
    <ReviewForm
      key={`${userId}/${restaurantId}/${attempt}`}
      accessToken={session?.access_token ?? ''}
      initialReview={loadState.review}
      restaurantId={restaurantId}
      onSaved={(response) => {
        onSaved?.(response);
        void refreshProfile();
      }}
    />
  );
}

function ReviewForm({
  accessToken,
  initialReview,
  restaurantId,
  onSaved,
}: {
  accessToken: string;
  initialReview: ReviewDraft;
  restaurantId: string;
  onSaved: (response: ReviewResponse) => void;
}) {
  const [draft, setDraft] = useState(() => createReviewDraft(initialReview.rating, initialReview.text));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setValidationError(null);
    setSaveError(null);
    setSaved(false);
    const message = reviewValidationMessage(draft);
    if (message) {
      setValidationError(message);
      return;
    }

    setSaving(true);
    try {
      const response = await submitReview({
        apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
        accessToken,
        restaurantId,
        review: reviewPayload(draft),
      });
      setDraft(createReviewDraft(response.review.rating, response.review.text));
      setSaved(true);
      onSaved(response);
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : 'Your review could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.editor}>
      <View style={styles.heading}>
        <AppText variant="heading" strong>Your rating</AppText>
        <AppText variant="small" muted>
          Ratings can use one decimal place. A written review is optional.
        </AppText>
      </View>
      <RatingInput
        value={draft.rating}
        disabled={saving}
        onChange={(rating) => {
          setDraft((current) => updateDraftRating(current, rating));
          setValidationError(null);
          setSaved(false);
        }}
      />
      <FormField
        label="Review (optional)"
        value={draft.text}
        onChangeText={(text) => {
          setDraft((current) => ({ ...current, text }));
          setValidationError(null);
          setSaved(false);
        }}
        editable={!saving}
        multiline
        maxLength={500}
        autoCapitalize="sentences"
        autoCorrect
        placeholder="What stood out?"
        hint={`${draft.text.length} / 500 characters`}
        error={validationError ?? undefined}
      />
      {saveError ? (
        <View style={styles.error} accessibilityRole="alert">
          <AppText variant="small" style={styles.errorText}>{saveError}</AppText>
        </View>
      ) : null}
      {saved ? (
        <View style={styles.success} accessibilityRole="alert">
          <AppText variant="small" style={styles.successText}>Review saved.</AppText>
        </View>
      ) : null}
      <Button label="Save review" loading={saving} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    padding: spacing.lg,
    gap: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  heading: { gap: spacing.xs },
  error: { padding: spacing.md, borderRadius: radius.control, backgroundColor: colors.errorSoft },
  errorText: { color: colors.error },
  success: { padding: spacing.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  successText: { color: colors.success },
});
