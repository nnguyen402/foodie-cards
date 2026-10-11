import { toRating } from './collection';
import type { CardRow } from './mapCard';
import { toCardView } from './mapCard';
import type { CardView } from './types';

export type CardDetail = {
  card: CardView;
  reviewText: string;
  visits: string[];
  dishes: { id: string; name: string; firstPurchaseDate: string }[];
};
export type VisitRow = { visit_date: string };
export type DishRow = { menu_item_id: string; first_purchase_date: string; menu_items: { canonical_name: string } | null };
export type DetailReviewRow = { rating: number | string | null; text: string } | null;

export function buildCardDetail(card: CardRow, review: DetailReviewRow, visits: VisitRow[], dishes: DishRow[]): CardDetail | null {
  const view = toCardView(card, toRating(review?.rating));
  if (!view) return null;
  return {
    card: view,
    reviewText: review?.text ?? '',
    visits: [...new Set(visits.map((visit) => visit.visit_date))].sort().reverse(),
    dishes: dishes
      .flatMap((dish) => (dish.menu_items ? [{ id: dish.menu_item_id, name: dish.menu_items.canonical_name, firstPurchaseDate: dish.first_purchase_date }] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Receipt dates are local calendar dates, so format from the parts instead of parsing through Date.
export function formatCalendarDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : date;
}
