import { Platform, type TextStyle } from 'react-native';
import type { RestaurantTheme } from '@foodie-cards/shared';

// Interim system-font stand-ins for the four name styles. Replace with the bundled
// licensed families once the integrator approves the font dependencies.
const nameFonts: Record<RestaurantTheme['fontKey'], TextStyle> = {
  rounded: { fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }), fontWeight: '800' },
  bold: { fontWeight: '900', letterSpacing: -0.3 },
  elegant: { fontFamily: Platform.select({ ios: 'ui-serif', android: 'serif', default: 'serif' }), fontWeight: '600' },
  friendly: { fontWeight: '600' },
};

export function nameFont(fontKey: RestaurantTheme['fontKey']): TextStyle {
  return nameFonts[fontKey];
}
