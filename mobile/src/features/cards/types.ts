import type { RestaurantStage, RestaurantTheme } from '@foodie-cards/shared';

// Lane-local view of a persisted card joined to its restaurant and the owner's rating.
export type CardView = {
  id: string;
  stage: RestaurantStage;
  cardXP: number;
  visitCount: number;
  lastVisitDate: string | null;
  rating: number | null;
  restaurant: {
    id: string;
    name: string;
    locationLabel: string;
    category: string;
    theme: RestaurantTheme;
    heroImagePath: string | null;
    heroImageKind: 'logo' | 'storefront' | 'food' | null;
  };
};
