import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { ReceiptDraft } from '@foodie-cards/shared';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { colors, radius, spacing, type as typeScale } from '@/theme/tokens';

type EditableReceiptItem = ReceiptDraft['items'][number] & { itemKey: string };

type ReceiptConfirmationProps = {
  draft: ReceiptDraft;
};

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function hasUncertainWarning(warnings: string[], originalText: string): boolean {
  return warnings.some((warning) =>
    /uncertain|review|check|unreadable/i.test(warning)
    && warning.toLocaleLowerCase().includes(originalText.toLocaleLowerCase()),
  );
}

async function submitReceiptPlaceholder(): Promise<void> {
  throw new Error('Receipt submission is not connected yet. Your edits are still here.');
}

export function ReceiptConfirmation({ draft }: ReceiptConfirmationProps) {
  const [restaurantId, setRestaurantId] = useState(draft.restaurantId ?? '');
  const [receiptDate, setReceiptDate] = useState(draft.receiptDate ?? '');
  const [items, setItems] = useState<EditableReceiptItem[]>(() =>
    draft.items.map((item, index) => ({ ...item, itemKey: `${draft.draftId}-${index}` })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(itemKey: string, patch: Partial<ReceiptDraft['items'][number]>) {
    setItems((current) => current.map((item) => item.itemKey === itemKey ? { ...item, ...patch } : item));
    setError(null);
  }

  function removeItem(itemKey: string) {
    setItems((current) => current.filter((item) => item.itemKey !== itemKey));
    setError(null);
  }

  async function confirm() {
    setError(null);
    if (!restaurantId.trim()) {
      setError('Choose a supported restaurant before confirming.');
      return;
    }
    if (!isValidDate(receiptDate)) {
      setError('Enter a valid receipt date in YYYY-MM-DD format.');
      return;
    }
    if (items.length === 0) {
      setError('Keep at least one food or drink item to confirm this receipt.');
      return;
    }
    if (items.some((item) => !item.suggestedName.trim() || !/^[1-9]\d*$/.test(String(item.quantity)))) {
      setError('Each item needs a name and a whole-number quantity greater than zero.');
      return;
    }

    setLoading(true);
    try {
      await submitReceiptPlaceholder();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Receipt confirmation failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <AppText variant="small" strong style={styles.eyebrow}>REVIEW RECEIPT</AppText>
          <AppText variant="display" strong>Check the details.</AppText>
          <AppText muted>Correct anything that was read incorrectly before confirming.</AppText>
        </View>

        {draft.warnings.length > 0 ? (
          <View style={styles.warningPanel} accessibilityRole="alert">
            <AppText variant="small" strong style={styles.warningTitle}>Please review</AppText>
            {draft.warnings.map((warning, index) => (
              <AppText key={`${warning}-${index}`} variant="small" style={styles.warningText}>• {warning}</AppText>
            ))}
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <AppText variant="heading" strong>Restaurant and date</AppText>
          <FormField
            label="Restaurant"
            value={restaurantId}
            onChangeText={(value) => { setRestaurantId(value); setError(null); }}
            placeholder="Choose a supported restaurant"
            hint="The restaurant catalog selector will be connected with the receipt flow."
            autoCapitalize="words"
            testID="receipt-restaurant"
          />
          <FormField
            label="Receipt date"
            value={receiptDate}
            onChangeText={(value) => { setReceiptDate(value); setError(null); }}
            placeholder="YYYY-MM-DD"
            hint="Use the local date printed on the receipt."
            keyboardType="numbers-and-punctuation"
            testID="receipt-date"
          />
        </View>

        <View style={styles.itemsHeading}>
          <View style={styles.sectionTitle}>
            <AppText variant="heading" strong>Food and drinks</AppText>
            <AppText variant="small" muted>{items.length} {items.length === 1 ? 'item' : 'items'}</AppText>
          </View>
          <AppText variant="small" muted>Original receipt text is shown beside each suggested name.</AppText>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyPanel}>
            <AppText variant="small" muted>No items yet. A receipt needs at least one food or drink item.</AppText>
          </View>
        ) : items.map((item) => {
          const uncertain = hasUncertainWarning(draft.warnings, item.originalText);
          return (
            <View key={item.itemKey} style={[styles.itemCard, uncertain ? styles.uncertainCard : undefined]}>
              <View style={styles.itemHeading}>
                <View style={styles.itemText}>
                  <AppText variant="caption" strong muted>RECEIPT SAYS</AppText>
                  <AppText strong>{item.originalText}</AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.originalText}`}
                  onPress={() => removeItem(item.itemKey)}
                  hitSlop={8}
                  style={styles.removeButton}
                >
                  <AppText variant="small" strong style={styles.removeText}>Remove</AppText>
                </Pressable>
              </View>
              {uncertain ? (
                <View style={styles.uncertainBadge}>
                  <AppText variant="caption" strong style={styles.uncertainText}>Check this uncertain reading</AppText>
                </View>
              ) : null}
              <View style={styles.itemFields}>
                <View style={styles.nameField}>
                  <AppText variant="small" strong>Suggested name</AppText>
                  <TextInput
                    accessibilityLabel={`Suggested name for ${item.originalText}`}
                    allowFontScaling
                    value={item.suggestedName}
                    onChangeText={(value) => updateItem(item.itemKey, { suggestedName: value })}
                    placeholder="Dish or drink name"
                    placeholderTextColor={colors.inkMuted}
                    selectionColor={colors.accent}
                    autoCapitalize="words"
                    style={styles.input}
                    testID={`receipt-item-name-${item.itemKey}`}
                  />
                </View>
                <View style={styles.quantityField}>
                  <AppText variant="small" strong>Quantity</AppText>
                  <TextInput
                    accessibilityLabel={`Quantity for ${item.originalText}`}
                    allowFontScaling
                    value={String(item.quantity)}
                    onChangeText={(value) => updateItem(item.itemKey, {
                      quantity: value === '' ? 0 : Number(value),
                    })}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={colors.inkMuted}
                    selectionColor={colors.accent}
                    style={styles.input}
                    testID={`receipt-item-quantity-${item.itemKey}`}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {error ? (
          <View style={styles.errorPanel} accessibilityRole="alert">
            <AppText variant="small" strong style={styles.errorTitle}>Could not confirm this receipt</AppText>
            <AppText variant="small" style={styles.errorText}>{error}</AppText>
            <AppText variant="caption" muted>Your restaurant, date, and item edits have been kept.</AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          {loading ? (
            <View style={styles.loadingState} accessibilityRole="progressbar" accessibilityLabel="Confirming receipt">
              <ActivityIndicator color={colors.accent} />
              <AppText variant="small" muted>Confirming receipt…</AppText>
            </View>
          ) : null}
          <Button
            label={error ? 'Retry confirmation' : 'Confirm receipt'}
            onPress={() => void confirm()}
            loading={loading}
            testID="confirm-receipt"
          />
          <AppText variant="caption" muted style={styles.noRewardsNote}>
            This screen only reviews receipt details. It does not calculate rewards.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.page, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  heading: { gap: spacing.sm, paddingBottom: spacing.sm },
  eyebrow: { letterSpacing: 1.2, color: colors.accent },
  warningPanel: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.card, backgroundColor: colors.accentSoft },
  warningTitle: { color: colors.accent },
  warningText: { color: colors.ink },
  detailsCard: { padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  itemsHeading: { gap: spacing.xs, paddingTop: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemCard: { padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  uncertainCard: { borderColor: colors.accent, borderWidth: 2 },
  itemHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  itemText: { flex: 1, gap: spacing.xs },
  removeButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  removeText: { color: colors.error },
  uncertainBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  uncertainText: { color: colors.accent },
  itemFields: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  nameField: { flex: 1, gap: spacing.sm },
  quantityField: { width: 96, gap: spacing.sm },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: typeScale.body,
  },
  emptyPanel: { padding: spacing.lg, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  errorPanel: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.control, backgroundColor: colors.errorSoft },
  errorTitle: { color: colors.error },
  errorText: { color: colors.error },
  actions: { gap: spacing.md, paddingTop: spacing.sm },
  loadingState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  noRewardsNote: { textAlign: 'center' },
});
