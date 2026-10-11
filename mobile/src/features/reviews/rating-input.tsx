import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { ReviewRequest } from '@foodie-cards/shared';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { colors, radius, spacing } from '@/theme/tokens';
import { MAX_RATING, formatRating, ratingFromText, sanitizeRatingText } from './rating-number';
import { RatingSlider } from './rating-slider';

type RatingInputProps = {
  value: ReviewRequest['rating'];
  onChange: (rating: ReviewRequest['rating']) => void;
  disabled?: boolean;
};

// Your own number from 0.0 to 5.0 with one decimal, typed or dragged. The field and the slider
// show the same value. A number over 5.0 is brought back to 5.0.
export function RatingInput({ value, onChange, disabled = false }: RatingInputProps) {
  const [text, setText] = useState(formatRating(value));

  // The slider or "Clear rating" changed the value: show it. While typing "4." the number is
  // already 4, so the field is left alone.
  useEffect(() => {
    if (ratingFromText(text) !== value) setText(formatRating(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.group}>
      <AppText variant="small" strong>Rating</AppText>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="Rating from 0 to 5, one decimal"
          editable={!disabled}
          inputMode="decimal"
          keyboardType="decimal-pad"
          maxLength={3}
          placeholder="4.3"
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.accent}
          value={text}
          onChangeText={(next) => {
            const clean = sanitizeRatingText(next);
            setText(clean);
            const rating = ratingFromText(clean);
            if (rating !== undefined) onChange(rating);
          }}
          onBlur={() => setText(formatRating(value))}
          style={[styles.input, disabled ? styles.disabled : undefined]}
        />
        <AppText muted>/ {MAX_RATING.toFixed(1)}</AppText>
        <View style={styles.spacer} />
        <Button label="Clear rating" variant="quiet" fullWidth={false} disabled={disabled || value === null} onPress={() => onChange(null)} />
      </View>
      <RatingSlider value={value} disabled={disabled} onChange={(rating) => onChange(rating)} />
      <AppText variant="caption" muted>
        {value === null ? 'Unrated. ' : ''}Type a number from 0.0 to 5.0, or drag. Zero is a rating.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    width: 84,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  spacer: { flex: 1 },
  disabled: { opacity: 0.55 },
});
