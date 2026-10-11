import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The app draws with React Native; here the same components render through react-native-web.
// Image is swapped for a plain <img> so the markup shows which source and fit it was given.
vi.mock('react-native', async () => {
  const web = await import('react-native-web');
  const Image = (props: { source?: { uri?: string }; resizeMode?: string; blurRadius?: number }) =>
    createElement('img', { 'data-src': props.source?.uri, 'data-fit': props.resizeMode, 'data-blur': props.blurRadius });
  return { ...web, Image };
});
// Image files cannot be required outside Metro, so art "exists" exactly where cuisineArt says it does.
vi.mock('../src/features/cards/cuisineArt', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/features/cards/cuisineArt')>();
  const fake = (key: import('../src/features/cards/cuisineArt').CuisineKey) => (real.hasCuisineArt(key) ? { uri: `art:${key}` } : null);
  return { ...real, getCuisineArt: fake, getCuisineCardArt: fake };
});

import { CuisineArt, type CuisineArtVariant } from '../src/features/cards/CuisineArtView';
import { CUISINE_KEYS, hasCuisineArt } from '../src/features/cards/cuisineArt';

const VARIANTS: CuisineArtVariant[] = ['token', 'card', 'thumb'];
const render = (cuisine: (typeof CUISINE_KEYS)[number], variant: CuisineArtVariant, locked = false) =>
  renderToStaticMarkup(createElement(CuisineArt, { cuisine, variant, locked }));

describe('CuisineArt', () => {
  it('renders every variant for every cuisine key without crashing', () => {
    for (const key of CUISINE_KEYS) for (const variant of VARIANTS) expect(render(key, variant)).not.toBe('');
  });

  it('shows the image where art exists and the drawn icon fallback where it does not', () => {
    for (const key of CUISINE_KEYS) {
      for (const variant of VARIANTS) {
        const html = render(key, variant);
        if (hasCuisineArt(key)) expect(html).toContain(`data-src="art:${key}"`);
        else expect(html).not.toContain('<img');
      }
    }
    expect(CUISINE_KEYS.some((key) => !hasCuisineArt(key))).toBe(true);
    expect(CUISINE_KEYS.some((key) => hasCuisineArt(key))).toBe(true);
  });

  it('draws the whole image in the card variant (once contained, once as the blurred backdrop) and covers in token and thumb', () => {
    const key = CUISINE_KEYS.find((candidate) => hasCuisineArt(candidate))!;
    const card = render(key, 'card');
    expect(card.match(/<img/g)).toHaveLength(2);
    expect(card).toContain('data-fit="contain"');
    expect(card).toContain('data-fit="cover"');
    expect(card).toContain('data-blur="24"');
    for (const variant of ['token', 'thumb'] as const) {
      const html = render(key, variant);
      expect(html.match(/<img/g)).toHaveLength(1);
      expect(html).toContain('data-fit="cover"');
      expect(html).not.toContain('data-blur');
    }
  });

  it('dims only when locked, for every cuisine and variant', () => {
    for (const key of CUISINE_KEYS) {
      for (const variant of VARIANTS) {
        expect(render(key, variant, true).length).toBeGreaterThan(render(key, variant, false).length);
      }
    }
  });

  it('covers steak, japanese and default', () => {
    for (const key of ['steak', 'japanese', 'default'] as const) expect(CUISINE_KEYS).toContain(key);
  });
});
