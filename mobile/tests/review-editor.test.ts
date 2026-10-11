import { describe, expect, it, vi } from 'vitest';
import { submitReview } from '../src/features/reviews/api';
import {
  clearDraftRating,
  createReviewDraft,
  reviewPayload,
  updateDraftRating,
} from '../src/features/reviews/model';

describe('review ratings', () => {
  it('accepts any value from 0.0 to 5.0 with one decimal', () => {
    for (const rating of [0, 0.1, 2.5, 4.3, 4.7, 5]) expect(updateDraftRating(createReviewDraft(), rating).rating).toBe(rating);
  });

  it('keeps zero distinct from unrated and can clear a rating', () => {
    const ratedZero = updateDraftRating(createReviewDraft(), 0);
    expect(ratedZero.rating).toBe(0);

    const cleared = clearDraftRating(ratedZero);
    expect(cleared.rating).toBeNull();
  });

  it('rejects ratings with more than one decimal or outside 0 to 5', () => {
    expect(() => updateDraftRating(createReviewDraft(), 4.25)).toThrow();
    expect(() => updateDraftRating(createReviewDraft(), -0.1)).toThrow();
    expect(() => updateDraftRating(createReviewDraft(), 5.5)).toThrow();
  });
});

describe('review payloads', () => {
  it('accepts zero, null, and optional text within 500 characters', () => {
    expect(reviewPayload({ rating: 0, text: '' })).toEqual({ rating: 0, text: '' });
    expect(reviewPayload({ rating: null, text: 'A thoughtful note.' })).toEqual({
      rating: null,
      text: 'A thoughtful note.',
    });
    expect(reviewPayload({ rating: 5, text: 'x'.repeat(500) }).text).toHaveLength(500);
  });

  it('rejects whitespace-only and oversized reviews', () => {
    expect(() => reviewPayload({ rating: 4.5, text: '   ' })).toThrow();
    expect(() => reviewPayload({ rating: 4.5, text: 'x'.repeat(501) })).toThrow();
  });

  it('sends a validated payload with bearer authentication and validates the response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      review: {
        restaurantId: '10000000-0000-4000-8000-000000000001',
        rating: 0,
        text: '',
        updatedAt: '2026-10-11T04:00:00.000Z',
      },
      accountXP: 50,
      accountLevel: 1,
      newBadges: ['first_impressions'],
      newTitles: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;

    const result = await submitReview({
      apiBaseUrl: 'https://api.example.com',
      accessToken: 'access-token',
      restaurantId: '10000000-0000-4000-8000-000000000001',
      review: { rating: 0, text: '' },
      fetcher,
    });

    expect(result.review.rating).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.com/api/reviews/10000000-0000-4000-8000-000000000001',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({ rating: 0, text: '' }),
      }),
    );
  });
});
