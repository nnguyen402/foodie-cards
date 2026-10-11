import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme/tokens';
import { MAX_RATING, clampRating, positionFromRating, ratingFromPosition } from './rating-number';

const THUMB = 28;
const TRACK = 6;

type RatingSliderProps = {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
};

// Drag, or tap anywhere on the track, to set the rating in steps of 0.1. VoiceOver and TalkBack
// can step it with the adjust gestures.
export function RatingSlider({ value, onChange, disabled = false }: RatingSliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startValue = useRef(0);
  const latest = useRef({ onChange, disabled });
  latest.current = { onChange, disabled };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      // Inside a ScrollView: once the drag starts, the slider keeps it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        startValue.current = ratingFromPosition(event.nativeEvent.locationX, widthRef.current);
        latest.current.onChange(startValue.current);
      },
      onPanResponderMove: (_event, gesture) => {
        if (widthRef.current <= 0) return;
        latest.current.onChange(clampRating(startValue.current + (gesture.dx / widthRef.current) * MAX_RATING));
      },
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };
  const fraction = positionFromRating(value);
  const step = (delta: number) => onChange(clampRating((value ?? 0) + delta));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Rating slider"
      accessibilityValue={{ min: 0, max: 50, now: Math.round((value ?? 0) * 10), text: value === null ? 'Unrated' : `${value.toFixed(1)} out of 5` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        step(event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1);
      }}
      onLayout={onLayout}
      style={[styles.hit, disabled ? styles.disabled : undefined]}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }, value === null ? styles.fillUnrated : undefined]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: fraction * width - THUMB / 2 }, value === null ? styles.thumbUnrated : undefined]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: TRACK, backgroundColor: colors.accent },
  fillUnrated: { backgroundColor: colors.border },
  thumb: { position: 'absolute', top: 8, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, boxShadow: '0 1px 4px rgba(0,0,0,0.35)' },
  thumbUnrated: { backgroundColor: colors.inkMuted },
  disabled: { opacity: 0.55 },
});
