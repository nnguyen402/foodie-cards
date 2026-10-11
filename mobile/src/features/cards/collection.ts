import { toCardView, toCatalogRestaurant, type CardRow } from './mapCard';
import type { CardView } from './types';

export type CatalogRestaurant = CardView['restaurant'];
export type RestaurantRow = NonNullable<CardRow['restaurants']>;
export type ReviewRow = { restaurant_id: string; rating: number | string | null };
export type Collection = { owned: CardView[]; locked: CatalogRestaurant[] };

export { toCatalogRestaurant };

export const RESTAURANT_SELECT = 'id,name,location_label,category,theme,hero_image_path,hero_image_kind';

// numeric(2,1) columns can arrive as strings; 0 is a real rating and must not become null.
export function toRating(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : null;
}

export function buildCollection(restaurants: RestaurantRow[], cards: CardRow[], reviews: ReviewRow[]): Collection {
  const ratings = new Map(reviews.map((review) => [review.restaurant_id, toRating(review.rating)]));
  const owned = cards.flatMap((row) => {
    const view = toCardView(row, row.restaurants ? (ratings.get(row.restaurants.id) ?? null) : null);
    return view ? [view] : [];
  });
  const ownedRestaurants = new Set(owned.map((card) => card.restaurant.id));
  const locked = restaurants
    .filter((restaurant) => !ownedRestaurants.has(restaurant.id))
    .map(toCatalogRestaurant)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { owned, locked };
}
