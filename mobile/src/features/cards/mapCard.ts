import { resolveRestaurantTheme, restaurantStageSchema, type RestaurantTheme } from '@foodie-cards/shared';
import type { CardView } from './types';

export const CARD_SELECT = 'id,card_xp,stage,visit_count,last_visit_date,restaurants(id,name,location_label,category,theme,hero_image_path,hero_image_kind)';

// Shape returned by CARD_SELECT. Stage and theme are unvalidated database values.
export type CardRow = {
  id: string;
  card_xp: number;
  stage: string;
  visit_count: number;
  last_visit_date: string | null;
  restaurants: {
    id: string;
    name: string;
    location_label: string;
    category: string;
    theme: Record<string, unknown> | null;
    hero_image_path: string | null;
    hero_image_kind: 'logo' | 'storefront' | 'food' | null;
  } | null;
};

export function toCatalogRestaurant(row: NonNullable<CardRow['restaurants']>): CardView['restaurant'] {
  return {
    id: row.id,
    name: row.name,
    locationLabel: row.location_label,
    category: row.category,
    theme: resolveRestaurantTheme(row.category, (row.theme ?? {}) as Partial<RestaurantTheme>),
    heroImagePath: row.hero_image_path,
    heroImageKind: row.hero_image_kind,
  };
}

export function toCardView(row: CardRow, rating: number | null): CardView | null {
  const stage = restaurantStageSchema.safeParse(row.stage);
  const restaurant = row.restaurants;
  if (!stage.success || !restaurant) return null;
  return {
    id: row.id,
    stage: stage.data,
    cardXP: row.card_xp,
    visitCount: row.visit_count,
    lastVisitDate: row.last_visit_date,
    rating,
    restaurant: toCatalogRestaurant(restaurant),
  };
}
