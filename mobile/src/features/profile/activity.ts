import { ratingSchema, type ReviewRequest } from '@foodie-cards/shared';

export type ProfileStatistics = {
  restaurantCount: number;
  verifiedVisitCount: number;
  distinctDishCount: number;
};

export type ProfileReview = {
  cardId: string;
  restaurantId: string;
  restaurantName: string;
  rating: ReviewRequest['rating'];
  text: string;
  updatedAt: string;
};

export type ActivityCardRow = {
  userId: string;
  restaurantId: string;
};

export type ActivityVisitRow = {
  userId: string;
  visitId: string;
};

export type ActivityDishRow = {
  userId: string;
  restaurantId: string;
  menuItemId: string;
};

export type ActivityReviewRow = {
  userId: string;
  cardId: string;
  restaurantId: string;
  restaurantName: string | null;
  rating: number | string | null;
  text: string;
  updatedAt: string;
};

export function buildProfileActivity(userId: string, input: {
  cards: readonly ActivityCardRow[];
  visits: readonly ActivityVisitRow[];
  dishes: readonly ActivityDishRow[];
  reviews: readonly ActivityReviewRow[];
}): { statistics: ProfileStatistics; reviews: ProfileReview[] } {
  const cards = input.cards.filter((row) => row.userId === userId);
  const visits = input.visits.filter((row) => row.userId === userId);
  const dishes = input.dishes.filter((row) => row.userId === userId);
  const reviews = input.reviews
    .filter((row) => row.userId === userId)
    .flatMap((row): ProfileReview[] => {
      const numericRating = row.rating === null ? null : Number(row.rating);
      const rating = ratingSchema.safeParse(numericRating);
      if (!rating.success) return [];
      const text = typeof row.text === 'string' ? row.text : '';
      if (rating.data === null && text.trim().length === 0) return [];
      return [{
        cardId: row.cardId,
        restaurantId: row.restaurantId,
        restaurantName: row.restaurantName?.trim() || 'Restaurant',
        rating: rating.data,
        text,
        updatedAt: row.updatedAt,
      }];
    })
    .sort((a, b) => {
      const timeDifference = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      return Number.isFinite(timeDifference) && timeDifference !== 0
        ? timeDifference
        : a.restaurantName.localeCompare(b.restaurantName);
    });

  return {
    statistics: {
      restaurantCount: new Set(cards.map((row) => row.restaurantId)).size,
      verifiedVisitCount: new Set(visits.map((row) => row.visitId)).size,
      distinctDishCount: new Set(dishes.map((row) => `${row.restaurantId}:${row.menuItemId}`)).size,
    },
    reviews,
  };
}
