import { describe, expect, it } from 'vitest';
import { buildCardDetail, formatCalendarDate } from '../src/features/cards/detail';
import type { CardRow } from '../src/features/cards/mapCard';

const cardRow = (overrides: Partial<CardRow> = {}): CardRow => ({
  id: 'card-1',
  card_xp: 330,
  stage: 'regular',
  visit_count: 3,
  last_visit_date: '2026-10-04',
  restaurants: {
    id: 'restaurant-1',
    name: 'The Varsity',
    location_label: 'Downtown',
    category: 'fast_food',
    theme: null,
    hero_image_path: null,
    hero_image_kind: null,
  },
  ...overrides,
});

describe('buildCardDetail', () => {
  it('returns null when the card cannot be drawn', () => {
    expect(buildCardDetail(cardRow({ stage: 'mythic' }), null, [], [])).toBeNull();
    expect(buildCardDetail(cardRow({ restaurants: null }), null, [], [])).toBeNull();
  });

  it('uses the review rating and text', () => {
    const detail = buildCardDetail(cardRow(), { rating: '4.5', text: 'Great chili dogs' }, [], []);
    expect(detail?.card.rating).toBe(4.5);
    expect(detail?.reviewText).toBe('Great chili dogs');
  });

  it('keeps a zero rating and treats a missing review as empty', () => {
    expect(buildCardDetail(cardRow(), { rating: 0, text: '' }, [], [])?.card.rating).toBe(0);
    const none = buildCardDetail(cardRow(), null, [], []);
    expect(none?.card.rating).toBeNull();
    expect(none?.reviewText).toBe('');
  });

  it('de-duplicates visits and lists the newest first', () => {
    const visits = [{ visit_date: '2026-09-01' }, { visit_date: '2026-10-04' }, { visit_date: '2026-09-01' }, { visit_date: '2026-09-15' }];
    expect(buildCardDetail(cardRow(), null, visits, [])?.visits).toEqual(['2026-10-04', '2026-09-15', '2026-09-01']);
  });

  it('sorts dishes by name and skips rows with a missing menu item', () => {
    const dishes = [
      { menu_item_id: 'm2', first_purchase_date: '2026-09-01', menu_items: { canonical_name: 'Frosted Orange' } },
      { menu_item_id: 'm3', first_purchase_date: '2026-09-02', menu_items: null },
      { menu_item_id: 'm1', first_purchase_date: '2026-10-04', menu_items: { canonical_name: 'Chili Dog' } },
    ];
    expect(buildCardDetail(cardRow(), null, [], dishes)?.dishes).toEqual([
      { id: 'm1', name: 'Chili Dog', firstPurchaseDate: '2026-10-04' },
      { id: 'm2', name: 'Frosted Orange', firstPurchaseDate: '2026-09-01' },
    ]);
  });
});

describe('formatCalendarDate', () => {
  it('formats a single-digit day', () => {
    expect(formatCalendarDate('2026-10-04')).toBe('Oct 4, 2026');
  });

  it('does not shift dates a UTC parse would move', () => {
    expect(formatCalendarDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatCalendarDate('2026-12-31')).toBe('Dec 31, 2026');
  });
});
