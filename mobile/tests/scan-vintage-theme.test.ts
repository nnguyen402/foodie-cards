import { describe, expect, it } from 'vitest';
import {
  FLOATING_TAB_BAR, framedPrintSize, heroHeight, tabBarClearance, tabScrollBottomPadding,
  vintage, vintageFont, vintageFontFamilies, vintageSpace, vintageText, withAlpha,
} from '../src/theme/vintage';
import { bannerCuisine } from '../src/features/map/bannerCuisine';

describe('vintage theme tokens', () => {
  it('uses the agreed palette', () => {
    expect(vintage).toEqual({
      deepRed: '#6B1414', crimson: '#8E1B1B', rust: '#B5482E', gold: '#D4A84B', cream: '#F3E6CF', ink: '#141212', sage: '#4E6B4A',
    });
  });

  it('keeps spacing on the 4/8/12/16/24/32 scale', () => {
    expect(Object.values(vintageSpace)).toEqual([4, 8, 12, 16, 24, 32]);
  });

  it('turns a hex colour and opacity into rgba', () => {
    expect(withAlpha('#F3E6CF', 0.85)).toBe('rgba(243,230,207,0.85)');
    expect(withAlpha('141212', 2)).toBe('rgba(20,18,18,1)');
    expect(() => withAlpha('#fff', 0.5)).toThrow();
  });

  it('only uses cream or gold for text on the dark ground', () => {
    expect(vintageText.primary).toBe(vintage.cream);
    expect(vintageText.accent).toBe(vintage.gold);
    expect(vintageText.muted).toBe('rgba(243,230,207,0.7)');
  });
});

describe('vintage fonts', () => {
  it('uses the Google font families once loaded', () => {
    expect(vintageFont('display', true)).toEqual({ fontFamily: vintageFontFamilies.display, fontWeight: '400' });
    expect(vintageFont('semibold', true).fontFamily).toBe('Inter_600SemiBold');
  });

  it('falls back to the system font at the same weight until loaded', () => {
    expect(vintageFont('body', false)).toEqual({ fontWeight: '400' });
    expect(vintageFont('semibold', false)).toEqual({ fontWeight: '600' });
    expect(vintageFont('display', false)).toEqual({ fontWeight: '700' });
    expect(vintageFont('display', false, 'Georgia')).toEqual({ fontFamily: 'Georgia', fontWeight: '700' });
  });
});

describe('layout helpers', () => {
  it('clears the floating tab bar above the bottom safe area', () => {
    expect(FLOATING_TAB_BAR).toBe(72);
    expect(tabBarClearance(0)).toBe(72);
    expect(tabBarClearance(34)).toBe(106);
    expect(tabBarClearance(-5)).toBe(72);
    expect(tabScrollBottomPadding(34)).toBe(130);
  });

  it('gives the hero about 38% of the screen', () => {
    expect(heroHeight(852)).toBe(324);
    expect(heroHeight(0)).toBe(0);
  });

  it('sizes a framed print to the photo so the mat hugs it', () => {
    // Tall receipt: height is the limit.
    expect(framedPrintSize({ width: 1000, height: 3000 }, 300, 400)).toEqual({ width: 133, height: 400 });
    // Wide photo: width is the limit.
    expect(framedPrintSize({ width: 2000, height: 1000 }, 300, 400)).toEqual({ width: 300, height: 150 });
    // Unknown size: a 3:4 portrait placeholder.
    expect(framedPrintSize(null, 300, 400)).toEqual({ width: 300, height: 400 });
    expect(framedPrintSize({ width: 0, height: 0 }, 300, 300)).toEqual({ width: 225, height: 300 });
  });
});

describe('unlock banner art', () => {
  it('picks the cuisine from generic words in the name', () => {
    expect(bannerCuisine('Taqueria El Sol')).toBe('mexican');
    expect(bannerCuisine('Corner Pizza Co')).toBe('pizza');
  });

  it('falls back to the default token when the name says nothing about the food', () => {
    expect(bannerCuisine('The Blue Door')).toBe('default');
  });
});
