import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';
import type { CollectionSort } from './sorting';

const OPTIONS: readonly { value: CollectionSort; label: string }[] = [
  { value: 'rating', label: 'Top rated' },
  { value: 'xp', label: 'Most XP' },
  { value: 'recent', label: 'Recent' },
];

const motionStyle = {
  transform: [{ scale: 1 }],
  transitionProperty: 'transform',
  transitionDuration: '120ms',
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;
const pressedMotionStyle = { transform: [{ scale: 0.97 }] } as const;

type SortControlProps = {
  value: CollectionSort;
  onChange: (sort: CollectionSort) => void;
};

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.pressable}
    >
      <Animated.View style={[
        motionStyle,
        styles.segment,
        { backgroundColor: selected ? colors.accent : 'transparent' },
        pressed && !reducedMotion ? pressedMotionStyle : undefined,
      ]}>
        <AppText variant="small" strong numberOfLines={1} style={{ color: selected ? colors.white : colors.ink }}>{label}</AppText>
      </Animated.View>
    </Pressable>
  );
}

export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Sort cards" style={styles.row}>
      {OPTIONS.map((option) => (
        <Segment
          key={option.value}
          label={option.label}
          selected={option.value === value}
          onPress={() => {
            if (option.value !== value) onChange(option.value);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  pressable: { flex: 1 },
  segment: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control - spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
