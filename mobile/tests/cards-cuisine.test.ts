import { describe, expect, it } from 'vitest';
import { CUISINE_KEYS, cuisineColors, cuisineIconFor, cuisineKeyFor, hasCuisineArt, normalizeCuisine } from '../src/features/cards/cuisineArt';
import { cuisineIcon } from '../src/features/cards/themes';
import { abilityLine } from '../src/features/map/labels';

describe('normalizeCuisine', () => {
  it('maps OSM tags, taking the first known value of a list', () => {
    expect(normalizeCuisine('burger;american')).toBe('burger');
    expect(normalizeCuisine('american;burger')).toBe('burger');
    expect(normalizeCuisine('regional;chicken')).toBe('chicken');
    for (const tag of ['chinese', 'japanese', 'sushi', 'thai', 'vietnamese', 'korean', 'ramen']) expect(normalizeCuisine(tag)).toBe('asian');
    expect(normalizeCuisine('tex-mex')).toBe('mexican');
    expect(normalizeCuisine('Tacos')).toBe('mexican');
    expect(normalizeCuisine('barbecue')).toBe('bbq');
    expect(normalizeCuisine('wings')).toBe('chicken');
    expect(normalizeCuisine('cafe')).toBe('coffee');
    expect(normalizeCuisine('coffee_shop')).toBe('coffee');
  });

  it('falls back to default for anything unknown or empty', () => {
    expect(normalizeCuisine('klingon')).toBe('default');
    expect(normalizeCuisine('')).toBe('default');
    expect(normalizeCuisine(null)).toBe('default');
  });
});

describe('cuisineKeyFor', () => {
  it('gives the seeded restaurants their cuisines', () => {
    expect(cuisineKeyFor({ name: 'The Varsity', category: 'fast_food' })).toBe('burger');
    expect(cuisineKeyFor({ name: 'Antico Pizza', category: 'pizza' })).toBe('pizza');
    expect(cuisineKeyFor({ name: 'Fox Bros Bar-B-Q', category: 'barbecue' })).toBe('bbq');
    expect(cuisineKeyFor({ name: 'Mary Mac’s Tea Room', category: 'southern' })).toBe('southern');
    expect(cuisineKeyFor({ name: 'Busy Bee Café', category: 'soul_food' })).toBe('southern');
  });

  it('uses one key for the label and the icon, so a burger place is never a plate', () => {
    expect(cuisineIcon('burger')).toBe('burger');
    expect(cuisineIconFor(normalizeCuisine('burger;american'))).toBe('burger');
  });
});

describe('cuisine art, colours and abilities', () => {
  it('has colours and an ability line for every key', () => {
    for (const key of CUISINE_KEYS) {
      expect(cuisineColors(key).ring).toMatch(/^#/);
      expect(abilityLine(key)).toContain('—');
    }
    expect(abilityLine('burger')).toBe('Grill Master — +25% XP on repeat visits');
    expect(abilityLine('coffee')).toBe('Morning Boost — bonus XP before 11am');
  });
});

describe('cuisine art files', () => {
  it('are listed only for cuisines with a committed image; the rest fall back to the drawn icon', () => {
    for (const key of ['pizza', 'asian', 'breakfast', 'coffee', 'chicken', 'southern', 'seafood'] as const) expect(hasCuisineArt(key)).toBe(true);
    for (const key of ['burger', 'mexican', 'bbq', 'dessert', 'default'] as const) expect(hasCuisineArt(key)).toBe(false);
  });
});
