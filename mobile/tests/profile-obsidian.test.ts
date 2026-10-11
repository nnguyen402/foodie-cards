import { describe, expect, it } from 'vitest';
import {
  OBSIDIAN_GRADIENT,
  SECTION_STAGGER_MS,
  cuisineDisplayName,
  discoveredLabel,
  favoriteCuisines,
  obsidian,
  sectionEnterDelay,
  xpSummary,
} from '../src/features/profile/obsidian';

describe('obsidian palette', () => {
  it('runs black into charcoal with silver accents', () => {
    expect(OBSIDIAN_GRADIENT).toEqual(['#0B0B0D', '#1C1C21', '#2A2A31']);
    expect(obsidian.silver).toBe('#C9CCD3');
    expect(obsidian.silverDeep).toBe('#8E929B');
    expect(obsidian.white).toBe('#F2F2F5');
  });
});

describe('section stagger', () => {
  it('delays each section 60ms after the one before', () => {
    expect(SECTION_STAGGER_MS).toBe(60);
    expect([0, 1, 2, 5].map(sectionEnterDelay)).toEqual([0, 60, 120, 300]);
    expect(sectionEnterDelay(-3)).toBe(0);
  });
});

describe('xp summary', () => {
  it('uses the 200 XP per level math from progress.ts', () => {
    expect(xpSummary(520, 3)).toEqual({
      level: 3,
      nextLevel: 4,
      xpIntoLevel: 120,
      xpPerLevel: 200,
      xpToNext: 80,
      fraction: 0.6,
      label: '120 / 200 XP · 80 to Lv 4',
    });
  });

  it('starts a fresh level empty and guards bad input', () => {
    expect(xpSummary(400, 3)).toMatchObject({ xpIntoLevel: 0, xpToNext: 200, fraction: 0 });
    expect(xpSummary(Number.NaN, Number.NaN)).toMatchObject({ level: 1, nextLevel: 2, xpIntoLevel: 0, fraction: 0 });
  });
});

describe('discovered label', () => {
  it('pluralises', () => {
    expect(discoveredLabel(1)).toBe('1 restaurant discovered');
    expect(discoveredLabel(4)).toBe('4 restaurants discovered');
    expect(discoveredLabel(-2)).toBe('0 restaurants discovered');
  });
});

describe('favorite cuisines', () => {
  it('counts cuisines from generic words in owned card names, most collected first', () => {
    const cards = [
      { restaurantName: 'Corner Pizza Co' },
      { restaurantName: 'Taqueria El Sol' },
      { restaurantName: 'Pizzeria Uno Mas' },
      { restaurantName: 'Ramen House' },
      { restaurantName: 'The Blue Door' },
      { restaurantName: null },
    ];
    expect(favoriteCuisines(cards)).toEqual([
      { key: 'pizza', count: 2 },
      { key: 'japanese', count: 1 },
      { key: 'mexican', count: 1 },
    ]);
  });

  it('respects the limit and returns nothing for an empty collection', () => {
    expect(favoriteCuisines([{ restaurantName: 'Corner Pizza Co' }, { restaurantName: 'Ramen House' }], 1)).toEqual([{ key: 'japanese', count: 1 }]);
    expect(favoriteCuisines([])).toEqual([]);
  });

  it('names cuisines for display', () => {
    expect(cuisineDisplayName('japanese')).toBe('Japanese');
    expect(cuisineDisplayName('bbq')).toBe('BBQ');
  });
});
