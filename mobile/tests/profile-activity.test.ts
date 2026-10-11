import { describe, expect, it } from 'vitest';
import {
  buildProfileActivity,
  type ActivityReviewRow,
} from '../src/features/profile/activity';

const userId = 'user-a';

function build(input: Partial<Parameters<typeof buildProfileActivity>[1]> = {}) {
  return buildProfileActivity(userId, {
    cards: input.cards ?? [],
    visits: input.visits ?? [],
    dishes: input.dishes ?? [],
    reviews: input.reviews ?? [],
  });
}

function review(overrides: Partial<ActivityReviewRow> = {}): ActivityReviewRow {
  return {
    userId,
    cardId: 'card-a',
    restaurantId: 'restaurant-a',
    restaurantName: 'Busy Bee Cafe',
    rating: 4.5,
    text: 'Great lunch.',
    updatedAt: '2026-10-10T18:00:00.000Z',
    ...overrides,
  };
}

describe('profile statistics', () => {
  it('counts distinct owned restaurants', () => {
    const result = build({
      cards: [
        { userId, restaurantId: 'restaurant-a' },
        { userId, restaurantId: 'restaurant-a' },
        { userId, restaurantId: 'restaurant-b' },
        { userId: 'user-b', restaurantId: 'restaurant-c' },
      ],
    });
    expect(result.statistics.restaurantCount).toBe(2);
  });

  it('counts verified visit records for the current user', () => {
    const result = build({
      visits: [
        { userId, visitId: 'visit-1' },
        { userId, visitId: 'visit-2' },
        { userId: 'user-b', visitId: 'visit-3' },
      ],
    });
    expect(result.statistics.verifiedVisitCount).toBe(2);
  });

  it('counts distinct restaurant and menu-item combinations instead of quantity', () => {
    const result = build({
      dishes: [
        { userId, restaurantId: 'restaurant-a', menuItemId: 'dish-1' },
        { userId, restaurantId: 'restaurant-a', menuItemId: 'dish-1' },
        { userId, restaurantId: 'restaurant-b', menuItemId: 'dish-1' },
        { userId, restaurantId: 'restaurant-a', menuItemId: 'dish-2' },
      ],
    });
    expect(result.statistics.distinctDishCount).toBe(3);
  });
});

describe('profile review history', () => {
  it('returns an empty history when there are no submitted ratings or reviews', () => {
    expect(build().reviews).toEqual([]);
    expect(build({ reviews: [review({ rating: null, text: '' })] }).reviews).toEqual([]);
  });

  it('preserves half-star and zero ratings', () => {
    const result = build({
      reviews: [
        review({ restaurantId: 'restaurant-zero', rating: 0, text: '' }),
        review({ restaurantId: 'restaurant-half', rating: '3.5' }),
      ],
    });
    expect(result.reviews.map((item) => item.rating).sort()).toEqual([0, 3.5]);
  });

  it('keeps null unrated when a written review exists', () => {
    const result = build({ reviews: [review({ rating: null, text: 'No star rating.' })] });
    expect(result.reviews[0]).toMatchObject({ rating: null, text: 'No star rating.' });
  });

  it('includes reviews with and without written text', () => {
    const result = build({
      reviews: [
        review({ restaurantId: 'rating-only', rating: 4, text: '' }),
        review({ restaurantId: 'written', rating: 2, text: 'Not for me.' }),
      ],
    });
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews.find((item) => item.restaurantId === 'rating-only')?.text).toBe('');
    expect(result.reviews.find((item) => item.restaurantId === 'written')?.text).toBe('Not for me.');
  });

  it('orders reviews by most recently updated', () => {
    const result = build({
      reviews: [
        review({ restaurantId: 'older', updatedAt: '2026-10-01T12:00:00.000Z' }),
        review({ restaurantId: 'newest', updatedAt: '2026-10-11T01:00:00.000Z' }),
        review({ restaurantId: 'middle', updatedAt: '2026-10-05T12:00:00.000Z' }),
      ],
    });
    expect(result.reviews.map((item) => item.restaurantId)).toEqual(['newest', 'middle', 'older']);
  });

  it('excludes activity belonging to another user', () => {
    const result = build({
      cards: [{ userId: 'user-b', restaurantId: 'restaurant-b' }],
      visits: [{ userId: 'user-b', visitId: 'visit-b' }],
      dishes: [{ userId: 'user-b', restaurantId: 'restaurant-b', menuItemId: 'dish-b' }],
      reviews: [review({ userId: 'user-b', restaurantId: 'restaurant-b' })],
    });
    expect(result.statistics).toEqual({
      restaurantCount: 0,
      verifiedVisitCount: 0,
      distinctDishCount: 0,
    });
    expect(result.reviews).toEqual([]);
  });
});
