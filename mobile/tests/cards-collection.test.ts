import { describe, expect, it } from 'vitest';
import { buildCollection, RESTAURANT_SELECT, toCatalogRestaurant, type RestaurantRow } from '../src/features/cards/collection';
import type { CardRow } from '../src/features/cards/mapCard';

const restaurant = (id: string, name: string): RestaurantRow => ({
  id,
  name,
  location_label: 'Downtown',
  category: 'fast_food',
  theme: null,
  hero_image_path: null,
  hero_image_kind: null,
});

const card = (id: string, restaurants: RestaurantRow | null, stage = 'regular'): CardRow => ({
  id,
  card_xp: 100,
  stage,
  visit_count: 2,
  last_visit_date: '2026-10-04',
  restaurants,
});

const varsity = restaurant('r-varsity', 'The Varsity');
const zesto = restaurant('r-zesto', 'Zesto');
const ambrosia = restaurant('r-ambrosia', 'Ambrosia');

describe('catalog restaurants', () => {
  it('map row fields and resolve the theme', () => {
    const mapped = toCatalogRestaurant(varsity);
    expect(mapped).toMatchObject({ id: 'r-varsity', name: 'The Varsity', locationLabel: 'Downtown', category: 'fast_food', heroImagePath: null, heroImageKind: null });
    expect(mapped.theme.primaryColor).toBeTruthy();
  });

  it('selects the columns the mapper reads', () => {
    expect(RESTAURANT_SELECT).toBe('id,name,location_label,category,theme,hero_image_path,hero_image_kind');
  });
});

describe('buildCollection', () => {
  it('splits owned cards from locked restaurants, locked sorted by name', () => {
    const result = buildCollection([zesto, varsity, ambrosia], [card('c1', varsity)], []);
    expect(result.owned.map((c) => c.id)).toEqual(['c1']);
    expect(result.locked.map((r) => r.name)).toEqual(['Ambrosia', 'Zesto']);
  });

  it('keeps owned cards in the order given', () => {
    const result = buildCollection([varsity, zesto], [card('c2', zesto), card('c1', varsity)], []);
    expect(result.owned.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(result.locked).toEqual([]);
  });

  it('attaches ratings: value, zero, null and missing review', () => {
    const result = buildCollection(
      [varsity, zesto, ambrosia],
      [card('c1', varsity), card('c2', zesto), card('c3', ambrosia)],
      [
        { restaurant_id: 'r-varsity', rating: 0 },
        { restaurant_id: 'r-zesto', rating: null },
      ],
    );
    expect(result.owned.map((c) => c.rating)).toEqual([0, null, null]);
  });

  it('coerces numeric string ratings', () => {
    const result = buildCollection([varsity], [card('c1', varsity)], [{ restaurant_id: 'r-varsity', rating: '4.5' }]);
    expect(result.owned[0].rating).toBe(4.5);
  });

  it('skips cards with an unknown stage and counts their restaurant as locked', () => {
    const result = buildCollection([varsity], [card('c1', varsity, 'mythic')], []);
    expect(result.owned).toEqual([]);
    expect(result.locked.map((r) => r.id)).toEqual(['r-varsity']);
  });

  it('skips cards without a restaurant', () => {
    expect(buildCollection([varsity], [card('c1', null)], []).owned).toEqual([]);
  });
});
