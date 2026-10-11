import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { CuisineIcon } from './CuisineIcon';
import { cuisineColors, cuisineIconFor, getCuisineArt, getCuisineCardArt, type CuisineKey } from './cuisineArt';

// The one place cuisine art is drawn. Every screen (map tokens, the sheet thumbnail, the card
// in the collection, detail, reveal and map popup) goes through here, so a cuisine looks the
// same everywhere and a missing image falls back the same way.
//   token: a circle, image covers it.      thumb: a rounded square, image covers it.
//   card:  the whole image, contained and centred, over a blurred copy of itself so the
//          window never shows empty bars.
// It fills its parent; the parent decides the size and any outer clipping.

export type CuisineArtVariant = 'token' | 'card' | 'thumb';
export type CuisineArtTint = { background: string; ink: string };

const RADIUS: Record<CuisineArtVariant, number> = { token: 9999, thumb: 14, card: 0 };
const BLUR = 24;
const BACKDROP_DIM = 'rgba(18,14,11,0.35)';
const LOCKED_DIM = 'rgba(18,14,11,0.45)';

type CuisineArtProps = {
  cuisine: CuisineKey;
  variant: CuisineArtVariant;
  /** Not collected yet: dims the art so it reads as locked. */
  locked?: boolean;
  /** Colours for the drawn-icon fallback. Defaults to the cuisine's own colours. */
  tint?: CuisineArtTint;
  /** Wraps the fallback icon, for a caller that animates it. */
  iconWrapper?: (icon: ReactNode) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CuisineArt({ cuisine, variant, locked = false, tint, iconWrapper, style }: CuisineArtProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const source = variant === 'card' ? getCuisineCardArt(cuisine) : getCuisineArt(cuisine);
  const onLayout = (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  const shortSide = Math.min(size.width, size.height);

  let content: ReactNode;
  if (source && variant === 'card') {
    content = (
      <>
        <Image source={source} resizeMode="cover" blurRadius={BLUR} style={styles.fill} accessibilityIgnoresInvertColors />
        <View pointerEvents="none" style={[styles.fill, { backgroundColor: BACKDROP_DIM }]} />
        <Image source={source} resizeMode="contain" style={styles.fill} accessibilityIgnoresInvertColors />
      </>
    );
  } else if (source) {
    content = <Image source={source} resizeMode="cover" style={styles.fill} accessibilityIgnoresInvertColors />;
  } else {
    const colors = cuisineColors(cuisine);
    const { background, ink } = tint ?? { background: colors.fill, ink: colors.ink };
    const icon = <CuisineIcon kind={cuisineIconFor(cuisine)} size={Math.round(shortSide * (variant === 'card' ? 0.34 : 0.62))} color={ink} cutout={background} />;
    const wrapped = iconWrapper ? iconWrapper(icon) : icon;
    content = variant === 'card' ? (
      <View style={styles.centred}>
        <View style={[styles.centred, { width: shortSide * 0.54, height: shortSide * 0.54, borderRadius: shortSide, backgroundColor: background }]}>{wrapped}</View>
      </View>
    ) : (
      <View style={[styles.centred, { backgroundColor: background }]}>{wrapped}</View>
    );
  }

  return (
    <View onLayout={onLayout} style={[styles.root, { borderRadius: RADIUS[variant] }, style]}>
      {content}
      {locked ? <View pointerEvents="none" style={[styles.fill, { backgroundColor: LOCKED_DIM }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', height: '100%', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  centred: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
});
