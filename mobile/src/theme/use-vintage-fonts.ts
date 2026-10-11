import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFonts as useCinzel, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { vintageFont, type VintageFontRole } from './vintage';

const SYSTEM_SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

/**
 * Loads Cinzel (display) and Inter (body) and never blocks rendering: until both are ready,
 * `font(role)` returns the system font at the same weight. A failed load stays on the fallback.
 */
export function useVintageFonts() {
  const [cinzelLoaded] = useCinzel({ Cinzel_700Bold });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const loaded = cinzelLoaded && interLoaded;
  const font = useCallback((role: VintageFontRole) => vintageFont(role, loaded, SYSTEM_SERIF), [loaded]);
  return { loaded, font };
}
