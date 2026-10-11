import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vintage, vintageRadius, vintageSpace, vintageText, withAlpha } from '@/theme/vintage';
import { useVintageFonts } from '@/theme/use-vintage-fonts';

// Props that dress the shared Button, FormField and MessagePanel in the vintage look, so the
// Scan and Review screens restyle them without forking them.

export function useVintageKit() {
  const { font, loaded } = useVintageFonts();
  return useMemo(() => {
    const buttonText = [styles.buttonText, font('semibold')];
    return {
      font,
      fontsLoaded: loaded,
      /** Crimson fill, gold hairline, cream label. */
      primaryButton: { style: styles.primaryButton, textStyle: buttonText },
      /** Transparent with a gold hairline. */
      outlineButton: { style: styles.outlineButton, textStyle: buttonText },
      /** A small text button in gold. */
      quietButton: { style: styles.quietButton, textStyle: [styles.quietText, font('semibold')] },
      field: {
        labelStyle: [styles.fieldLabel, font('semibold')],
        inputStyle: [styles.fieldInput, font('body')],
        focusedInputStyle: styles.fieldFocused,
        hintStyle: [styles.fieldHint, font('body')],
        placeholderTextColor: withAlpha(vintage.cream, 0.45),
        selectionColor: vintage.gold,
      },
      /** A dark card with a coloured left accent bar and an icon. */
      notice: (kind: 'error' | 'plain' = 'error') => ({
        style: [styles.notice, kind === 'error' ? styles.noticeError : styles.noticePlain],
        titleStyle: [styles.noticeTitle, font('semibold')],
        bodyStyle: [styles.noticeBody, font('body')],
        icon: (
          <View style={styles.noticeIcon}>
            <Ionicons name={kind === 'error' ? 'alert-circle' : 'information-circle'} size={24} color={kind === 'error' ? vintage.rust : vintage.gold} />
          </View>
        ),
      }),
    };
  }, [font, loaded]);
}

/** Shared card surface: ink, gold hairline, rounded 16. */
export const vintageCard = {
  backgroundColor: withAlpha(vintage.ink, 0.92),
  borderWidth: 1,
  borderColor: withAlpha(vintage.gold, 0.45),
  borderRadius: vintageRadius.card,
  padding: vintageSpace.xl,
  gap: vintageSpace.lg,
} as const;

const styles = StyleSheet.create({
  primaryButton: { minHeight: 52, borderRadius: vintageRadius.control, backgroundColor: vintage.crimson, borderColor: vintage.gold, borderWidth: 1 },
  outlineButton: { minHeight: 52, borderRadius: vintageRadius.control, backgroundColor: 'transparent', borderColor: vintage.gold, borderWidth: 1 },
  quietButton: { minHeight: 44, paddingHorizontal: vintageSpace.md, borderRadius: vintageRadius.control, backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonText: { color: vintage.cream, fontSize: 16, lineHeight: 22, letterSpacing: 0.3 },
  quietText: { color: vintage.gold, fontSize: 15, lineHeight: 20 },
  fieldLabel: { color: vintageText.primary, fontSize: 14, lineHeight: 19 },
  fieldInput: { backgroundColor: vintage.ink, borderColor: withAlpha(vintage.gold, 0.4), color: vintage.cream, borderRadius: vintageRadius.control },
  fieldFocused: { borderColor: vintage.gold, borderWidth: 2 },
  fieldHint: { color: vintageText.muted, fontSize: 13, lineHeight: 18 },
  notice: { backgroundColor: withAlpha(vintage.ink, 0.92), borderRadius: vintageRadius.card, borderWidth: 1, borderColor: withAlpha(vintage.gold, 0.35), borderLeftWidth: 4, padding: vintageSpace.lg, alignSelf: 'stretch' },
  noticeError: { borderLeftColor: vintage.rust },
  noticePlain: { borderLeftColor: vintage.gold },
  noticeTitle: { color: vintage.cream, fontSize: 17, lineHeight: 22 },
  noticeBody: { color: vintageText.secondary, fontSize: 14, lineHeight: 20 },
  noticeIcon: { paddingTop: 0 },
});
