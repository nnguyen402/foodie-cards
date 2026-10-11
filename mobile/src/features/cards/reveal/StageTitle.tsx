import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { REDUCED_FADE_MS, type RevealScript } from './script';

// The stage name slams in letter by letter, then the restaurant name fades up
// under it. Mirrors bannerIn in the reference.

const INK = '#f6ede2';

const letterKeyframes = {
  from: { opacity: 0, transform: [{ translateY: -10 }, { scale: 3.2 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
};
const nameKeyframes = {
  from: { opacity: 0, transform: [{ translateY: 8 }] },
  to: { opacity: 0.9, transform: [{ translateY: 0 }] },
};
const fadeKeyframes = { from: { opacity: 0 }, to: { opacity: 1 } };

type StageTitleProps = {
  script: RevealScript;
  restaurantName: string;
  /** Show the finished title with no motion, for Skip. */
  instant?: boolean;
  /** Fade the whole block in instead of animating letters, for Reduce Motion. */
  fade?: boolean;
};

export function StageTitle({ script, restaurantName, instant = false, fade = false }: StageTitleProps) {
  const { title, label } = script;
  const stillLetters = instant || fade;
  const words = useMemo(() => {
    let index = 0;
    return label.split(' ').map((word) => [...word].map((char) => ({ char, index: index++ })));
  }, [label]);
  const textShadow = title.glow
    ? { textShadowColor: title.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 }
    : { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 };

  return (
    <Animated.View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label}, ${restaurantName}`}
      style={[styles.block, fade ? { animationName: fadeKeyframes, animationDuration: REDUCED_FADE_MS, animationFillMode: 'both' } : null]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.words}>
        {words.map((letters, wordIndex) => (
          <View key={wordIndex} style={styles.word}>
            {letters.map(({ char, index }) => (
              <Animated.Text
                key={index}
                allowFontScaling={false}
                style={[styles.letter, textShadow, { color: title.color }, stillLetters ? null : {
                  opacity: 0, animationName: letterKeyframes, animationDuration: title.letterMs, animationDelay: index * title.staggerMs,
                  animationFillMode: 'both', animationTimingFunction: cubicBezier(0.2, 1.4, 0.4, 1),
                }]}
              >
                {char}
              </Animated.Text>
            ))}
          </View>
        ))}
      </View>
      <Animated.Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.name, stillLetters ? { opacity: 0.9 } : {
          opacity: 0, animationName: nameKeyframes, animationDuration: title.nameFadeMs, animationDelay: title.nameAtMs, animationFillMode: 'both', animationTimingFunction: 'ease-out',
        }]}
      >
        {restaurantName}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', paddingHorizontal: 16 },
  words: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14 },
  word: { flexDirection: 'row' },
  letter: { fontSize: 36, fontWeight: '900', letterSpacing: 1.5 },
  name: { marginTop: 6, color: INK, fontSize: 13, fontWeight: '700', letterSpacing: 2.6, textTransform: 'uppercase', textAlign: 'center' },
});
