import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { AppText } from './app-text';
import { colors, radius, spacing } from '@/theme/tokens';

type ButtonProps = Pick<PressableProps, 'onPress' | 'accessibilityLabel' | 'testID'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Optional overrides for screens with their own look. Defaults leave the shared style unchanged. */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: ReactNode;
};

const motionStyle = {
  transform: [{ scale: 1 }],
  transitionProperty: 'transform',
  transitionDuration: '120ms',
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;
const pressedMotionStyle = { transform: [{ scale: 0.97 }] } as const;

export function Button({ label, onPress, accessibilityLabel, testID, variant = 'primary', loading = false, disabled = false, fullWidth = true, style, textStyle, leftIcon }: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();
  const unavailable = disabled || loading;
  const palette = variant === 'primary'
    ? { backgroundColor: colors.accent, text: colors.white, borderColor: colors.accent }
    : variant === 'danger'
      ? { backgroundColor: colors.error, text: colors.white, borderColor: colors.error }
      : variant === 'secondary'
        ? { backgroundColor: colors.surface, text: colors.ink, borderColor: colors.border }
        : { backgroundColor: 'transparent', text: colors.accent, borderColor: 'transparent' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={4}
      pressRetentionOffset={12}
      testID={testID}
      style={fullWidth ? { width: '100%' } : undefined}
    >
      <Animated.View style={[
        motionStyle,
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        style,
        unavailable ? styles.unavailable : undefined,
        pressed && !unavailable && !reducedMotion ? pressedMotionStyle : undefined,
      ]}>
        {loading ? <ActivityIndicator color={(StyleSheet.flatten(textStyle)?.color as string | undefined) ?? palette.text} /> : <>{leftIcon}<AppText strong style={[{ color: palette.text }, textStyle]}>{label}</AppText></>}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unavailable: { opacity: 0.55 },
});
