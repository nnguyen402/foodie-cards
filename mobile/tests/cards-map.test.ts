import { describe, expect, it } from 'vitest';
import { toCardView, type CardRow } from '../src/features/cards/mapCard';

const row = (overrides: Partial<CardRow> = {}): CardRow => ({
  id: 'card-1',
  card_xp: 330,
  stage: 'regular',
  visit_count: 3,
  last_visit_date: '2026-10-04',
  restaurants: {
    id: 'restaurant-1',
    name: 'The Varsity',
    location_label: 'Downtown · 61 North Ave NW',
    category: 'fast_food',
    theme: { primaryColor: '#9E1B32', accentColor: '#F2C94C', fontKey: 'bold', patternKey: 'dots' },
    hero_image_path: null,
    hero_image_kind: null,
  },
  ...overrides,
});

describe('persisted card rows', () => {
  it('become a card view with the restaurant theme and the owner rating', () => {
    expect(toCardView(row(), 4.5)).toEqual({
      id: 'card-1',
      stage: 'regular',
      cardXP: 330,
      visitCount: 3,
      lastVisitDate: '2026-10-04',
      rating: 4.5,
      restaurant: {
        id: 'restaurant-1',
        name: 'The Varsity',
        locationLabel: 'Downtown · 61 North Ave NW',
        category: 'fast_food',
        theme: { primaryColor: '#9E1B32', accentColor: '#F2C94C', fontKey: 'bold', patternKey: 'dots' },
        heroImagePath: null,
        heroImageKind: null,
      },
    });
  });

  it('keep a zero-star rating distinct from unrated', () => {
    expect(toCardView(row(), 0)?.rating).toBe(0);
    expect(toCardView(row(), null)?.rating).toBeNull();
  });

  it('use the category default when the restaurant has no theme', () => {
    const cafe = row({ restaurants: { ...row().restaurants!, category: 'cafe', theme: null } });
    expect(toCardView(cafe, null)?.restaurant.theme)
      .toEqual({ primaryColor: '#F2E4CC', accentColor: '#8A563A', fontKey: 'friendly', patternKey: 'paper' });
  });

  it('use the neutral theme for an unknown category with an unusable theme', () => {
    const odd = row({ restaurants: { ...row().restaurants!, category: 'food_truck', theme: { primaryColor: 'red' } } });
    expect(toCardView(odd, null)?.restaurant.theme)
      .toEqual({ primaryColor: '#ECEBE7', accentColor: '#66645F', fontKey: 'friendly', patternKey: 'none' });
  });

  it('are skipped when the stage is not one the app can draw', () => {
    expect(toCardView(row({ stage: 'legendary' }), null)).toBeNull();
  });

  it('are skipped when the restaurant is missing', () => {
    expect(toCardView(row({ restaurants: null }), null)).toBeNull();
  });
});
