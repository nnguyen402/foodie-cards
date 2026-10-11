import { Platform, type ViewStyle } from 'react-native';

// CSS gradients without an extra dependency: React Native reads them from
// experimental_backgroundImage, the web build from backgroundImage. The solid
// colour shows wherever a gradient is unavailable.
export function gradient(css: string, fallbackColor: string): ViewStyle {
  return Platform.OS === 'web'
    ? ({ backgroundColor: fallbackColor, backgroundImage: css } as ViewStyle)
    : { backgroundColor: fallbackColor, experimental_backgroundImage: css };
}
