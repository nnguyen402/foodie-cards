import { Pressable, StyleSheet, View } from 'react-native';
import type { ReviewRequest } from '@foodie-cards/shared';
import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';
import { ratingValues } from './model';

type RatingInputProps = {
  value: ReviewRequest['rating'];
  onChange: (rating: ReviewRequest['rating']) => void;
  disabled?: boolean;
};

export function RatingInput({ value, onChange, disabled = false }: RatingInputProps) {
  return (
    <View style={styles.group}>
      <AppText variant="small" strong>Rating</AppText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Restaurant rating"
        style={styles.options}
      >
        <RatingChoice
          label="Unrated"
          accessibilityLabel="Clear rating"
          selected={value === null}
          disabled={disabled}
          onPress={() => onChange(null)}
        />
        {ratingValues.map((rating) => (
          <RatingChoice
            key={rating}
            label={rating.toFixed(1)}
            accessibilityLabel={`${rating} out of 5 stars`}
            selected={value === rating}
            disabled={disabled}
            onPress={() => onChange(rating)}
          />
        ))}
      </View>
      <AppText variant="caption" muted>
        Zero is a rating. Unrated clears your rating.
      </AppText>
    </View>
  );
}

function RatingChoice({
  label,
  accessibilityLabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected ? styles.selected : undefined,
        disabled ? styles.disabled : undefined,
      ]}
    >
      <AppText
        variant="small"
        strong={selected}
        style={selected ? styles.selectedText : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 44,
    minWidth: 54,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  selectedText: { color: colors.accent },
  disabled: { opacity: 0.55 },
});
