import { describe, expect, it } from 'vitest';
import { CUISINE_KEYS, cuisineColors, cuisineIconFor, cuisineKeyFor, hasCuisineArt, normalizeCuisine } from '../src/features/cards/cuisineArt';
import { cuisineIcon } from '../src/features/cards/themes';
import { fixtureCards } from '../src/features/cards/fixtures';
import { abilityLine } from '../src/features/map/labels';

describe('normalizeCuisine (cuisine tags)', () => {
  it('maps OSM tags, taking the first known value of a list', () => {
    expect(normalizeCuisine('burger;american')).toBe('burger');
    expect(normalizeCuisine('american;burger')).toBe('burger');
    expect(normalizeCuisine('regional;chicken')).toBe('chicken');
    for (const tag of ['chinese', 'thai', 'vietnamese', 'korean', 'noodle']) expect(normalizeCuisine(tag)).toBe('asian');
    for (const tag of ['japanese', 'sushi', 'ramen']) expect(normalizeCuisine(tag)).toBe('japanese');
    for (const tag of ['steak_house', 'steakhouse', 'steak']) expect(normalizeCuisine(tag)).toBe('steak');
    expect(normalizeCuisine('tex-mex')).toBe('mexican');
    expect(normalizeCuisine('Tacos')).toBe('mexican');
    expect(normalizeCuisine('barbecue')).toBe('bbq');
    expect(normalizeCuisine('wings')).toBe('chicken');
    expect(normalizeCuisine('coffee_shop')).toBe('coffee');
  });

  it('does not guess from vague tags', () => {
    for (const tag of ['american', 'fast_food', 'restaurant', 'sandwich', 'regional', 'klingon', '', null]) expect(normalizeCuisine(tag)).toBe('default');
  });
});

describe('cuisineKeyFor', () => {
  it('prefers the cuisine tag over words in the name', () => {
    expect(cuisineKeyFor({ name: 'Burger Palace', cuisine: 'pizza' })).toBe('pizza');
  });

  it('reads generic food words in the name, ignoring case and accents', () => {
    const named = (name: string) => cuisineKeyFor({ name, cuisine: null });
    expect(named('Antico Pizza')).toBe('pizza');
    expect(named('PIZZERIA Roma')).toBe('pizza');
    expect(named('No Mas Cantina')).toBe('mexican');
    expect(named('Taqueria del Sol')).toBe('mexican');
    expect(named('Tokyo Sushi Bar')).toBe('japanese');
    expect(named('Pho 79')).toBe('asian');
    expect(named('Golden Wok')).toBe('asian');
    expect(named('Smokehouse 7')).toBe('bbq');
    expect(named('Wing Stop Shack')).toBe('chicken');
    expect(named('Burgers & Shakes')).toBe('burger');
    expect(named('Café Brûlé')).toBe('coffee');
    expect(named('Corner Roastery')).toBe('coffee');
    expect(named('Sunrise Diner')).toBe('breakfast');
    expect(named('Prime Steakhouse')).toBe('steak');
    expect(named('Harbor Oyster House')).toBe('seafood');
    expect(named('Sweet Ice Cream')).toBe('dessert');
  });

  it('matches whole words only', () => {
    expect(cuisineKeyFor({ name: 'Photo Booth Grill', cuisine: null })).toBe('default');
  });

  it('uses amenity=cafe only after the tag and the name have said nothing', () => {
    expect(cuisineKeyFor({ name: 'The Corner Spot', cuisine: null, amenity: 'cafe' })).toBe('coffee');
    expect(cuisineKeyFor({ name: 'Slice Pizza', cuisine: null, amenity: 'cafe' })).toBe('pizza');
  });

  it('gives no art to a fast_food place with no cuisine and no food words', () => {
    const key = cuisineKeyFor({ name: 'Corner Spot', cuisine: null, amenity: 'fast_food' });
    expect(key).toBe('default');
    expect(hasCuisineArt(key)).toBe(false);
    expect(cuisineKeyFor({ name: 'Corner Spot', cuisine: 'fast_food' })).toBe('default');
  });

  it('maps our catalog categories the same way', () => {
    expect(cuisineKeyFor({ name: 'Antico Pizza', cuisine: 'pizza' })).toBe('pizza');
    expect(cuisineKeyFor({ name: 'Fox Bros Bar-B-Q', cuisine: 'barbecue' })).toBe('bbq');
    expect(cuisineKeyFor({ name: 'Mary Mac’s Tea Room', cuisine: 'southern' })).toBe('southern');
    expect(cuisineKeyFor({ name: 'Busy Bee Café', cuisine: 'soul_food' })).toBe('southern');
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
    for (const key of ['burger', 'pizza', 'asian', 'mexican', 'dessert', 'breakfast', 'coffee', 'chicken', 'southern', 'seafood', 'steak', 'japanese'] as const) expect(hasCuisineArt(key)).toBe(true);
    for (const key of ['bbq', 'default'] as const) expect(hasCuisineArt(key)).toBe(false);
  });
});

describe('seeded restaurants', () => {
  it('get their cuisine from their category data alone', () => {
    const expected: Record<string, string> = { '1': 'southern', '2': 'bbq', '3': 'southern', '4': 'burger', '5': 'pizza' };
    const seeded = fixtureCards('discovered').map(({ restaurant }) => restaurant);
    expect(seeded).toHaveLength(5);
    for (const restaurant of seeded) {
      const key = cuisineKeyFor({ name: '', cuisine: restaurant.category });
      expect(key).toBe(expected[restaurant.id.slice(-1)]);
      // Every seeded cuisine has an image except bbq, which still shows the drawn icon.
      expect(hasCuisineArt(key)).toBe(key !== 'bbq');
    }
  });
});
