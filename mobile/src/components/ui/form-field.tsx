import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { AppText } from './app-text';
import { colors, radius, spacing, type as typeScale } from '@/theme/tokens';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  testID?: string;
  /** Optional overrides for screens with their own look. Defaults leave the shared style unchanged. */
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
  focusedInputStyle?: StyleProp<TextStyle>;
  hintStyle?: StyleProp<TextStyle>;
};

export function FormField({ label, error, hint, testID, onFocus, onBlur, labelStyle, inputStyle, focusedInputStyle, hintStyle, ...inputProps }: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="small" strong style={labelStyle}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        allowFontScaling
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.accent}
        testID={testID}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, inputStyle, focused ? [styles.focused, focusedInputStyle] : undefined, error ? styles.invalid : undefined]}
        {...inputProps}
      />
      {error ? <AppText variant="small" style={styles.error}>{error}</AppText> : hint ? <AppText variant="small" muted style={hintStyle}>{hint}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: typeScale.body,
  },
  focused: { borderColor: colors.focus, borderWidth: 2 },
  invalid: { borderColor: colors.error },
  error: { color: colors.error },
});
