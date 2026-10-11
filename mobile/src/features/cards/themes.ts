import { cuisineIconFor, normalizeCuisine } from './cuisineArt';

// Text colours for a restaurant-coloured panel. Fixed values: a card is its own surface in light and dark mode.
export const cardInk = { light: '#FFFFFF', dark: '#2B211B' } as const;

export function readableTextOn(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Contrast against white is higher than against the dark ink below this luminance.
  return luminance < 0.36 ? cardInk.light : cardInk.dark;
}

export type CuisineIconKind = 'coffee' | 'bbq' | 'southern' | 'burger' | 'pizza' | 'sushi' | 'plate';

// Fallback art when a restaurant has no prepared image: the icon for its cuisine key (see cuisineArt.ts).
export function cuisineIcon(category: string): CuisineIconKind {
  return cuisineIconFor(normalizeCuisine(category));
}

export function ratingLabel(rating: number | null): string {
  return rating === null ? 'Unrated' : `★ ${rating}`;
}

// Spoken form for screen-reader labels: "rated 1 star", "rated 4.5 stars", "unrated".
export function ratingSpoken(rating: number | null): string {
  if (rating === null) return 'unrated';
  return `rated ${rating} ${rating === 1 ? 'star' : 'stars'}`;
}
