import { describe, expect, it } from 'vitest';
import { cuisineIcon, ratingLabel, ratingSpoken, readableTextOn } from '../src/features/cards/themes';

describe('card theme helpers', () => {
  it('puts light text on a dark restaurant colour', () => {
    expect(readableTextOn('#9E1B32')).toBe('#FFFFFF');
    expect(readableTextOn('#38261F')).toBe('#FFFFFF');
  });

  it('puts dark text on a light restaurant colour', () => {
    expect(readableTextOn('#F2E4CC')).toBe('#2B211B');
    expect(readableTextOn('#F2C94C')).toBe('#2B211B');
  });

  it('picks the fallback art icon from the restaurant category', () => {
    expect(cuisineIcon('soul_food')).toBe('southern');
    expect(cuisineIcon('cafe')).toBe('coffee');
    expect(cuisineIcon('barbecue')).toBe('bbq');
    expect(cuisineIcon('southern')).toBe('southern');
    expect(cuisineIcon('fast_food')).toBe('burger');
    expect(cuisineIcon('pizza')).toBe('pizza');
  });

  it('ignores case and spacing in the category', () => {
    expect(cuisineIcon(' Pizza ')).toBe('pizza');
  });

  it('uses a plain plate for a category without its own icon', () => {
    expect(cuisineIcon('food_truck')).toBe('plate');
  });

  it('shows a zero-star rating as a rating and null as unrated', () => {
    expect(ratingLabel(0)).toBe('★ 0');
    expect(ratingLabel(4.5)).toBe('★ 4.5');
    expect(ratingLabel(null)).toBe('Unrated');
  });
});

describe('ratingSpoken', () => {
  it('reads ratings naturally for screen readers', () => {
    expect(ratingSpoken(null)).toBe('unrated');
    expect(ratingSpoken(1)).toBe('rated 1 star');
    expect(ratingSpoken(4.5)).toBe('rated 4.5 stars');
    expect(ratingSpoken(0)).toBe('rated 0 stars');
  });
});
