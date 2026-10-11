import { describe, expect, it } from 'vitest';
import {
  clampRating,
  formatRating,
  positionFromRating,
  ratingFromPosition,
  ratingFromText,
  sanitizeRatingText,
} from '../src/features/reviews/rating-number';

describe('clampRating', () => {
  it('keeps one decimal inside 0.0 to 5.0', () => {
    expect(clampRating(4.3)).toBe(4.3);
    expect(clampRating(4.26)).toBe(4.3);
    expect(clampRating(7)).toBe(5);
    expect(clampRating(-2)).toBe(0);
    expect(clampRating(Number.NaN)).toBe(0);
  });
});

describe('typing a rating', () => {
  it('keeps one digit before the dot and one after', () => {
    expect(sanitizeRatingText('4.35')).toBe('4.3');
    expect(sanitizeRatingText('45')).toBe('4');
    expect(sanitizeRatingText('4..3')).toBe('4.3');
    expect(sanitizeRatingText('a4,3')).toBe('4');
    expect(sanitizeRatingText('.5')).toBe('.5');
  });

  it('reads empty as unrated, a lone dot as not yet a number, and clamps the rest', () => {
    expect(ratingFromText('')).toBeNull();
    expect(ratingFromText('.')).toBeUndefined();
    expect(ratingFromText('4.')).toBe(4);
    expect(ratingFromText('4.3')).toBe(4.3);
    expect(ratingFromText('0')).toBe(0);
    expect(ratingFromText('9')).toBe(5);
    expect(ratingFromText('.5')).toBe(0.5);
  });

  it('shows a value with one decimal, and nothing for unrated', () => {
    expect(formatRating(4.3)).toBe('4.3');
    expect(formatRating(5)).toBe('5.0');
    expect(formatRating(0)).toBe('0.0');
    expect(formatRating(null)).toBe('');
  });
});

describe('the slider', () => {
  it('maps a position on the track to 0.1 steps and back', () => {
    expect(ratingFromPosition(0, 300)).toBe(0);
    expect(ratingFromPosition(300, 300)).toBe(5);
    expect(ratingFromPosition(150, 300)).toBe(2.5);
    expect(ratingFromPosition(258, 300)).toBe(4.3);
    expect(ratingFromPosition(-20, 300)).toBe(0);
    expect(ratingFromPosition(400, 300)).toBe(5);
    expect(ratingFromPosition(10, 0)).toBe(0);
    expect(positionFromRating(null)).toBe(0);
    expect(positionFromRating(2.5)).toBe(0.5);
  });
});
