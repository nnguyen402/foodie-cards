export type CollectionSort = 'rating' | 'xp' | 'recent';

export type SortableCard = {
  id: string;
  rating: number | null;
  cardXP: number;
  lastVisitDate: string | null;
  restaurant: { name: string };
};

// Null means unrated or never visited and always sorts last; zero stars is a real rating.
function descendingNullsLast<T extends number | string>(a: T | null, b: T | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

export function sortCards<T extends SortableCard>(cards: readonly T[], sort: CollectionSort): T[] {
  return [...cards].sort((a, b) => {
    const primary = sort === 'rating'
      ? descendingNullsLast(a.rating, b.rating)
      : sort === 'recent'
        ? descendingNullsLast(a.lastVisitDate, b.lastVisitDate)
        : 0;
    return primary || b.cardXP - a.cardXP || a.restaurant.name.localeCompare(b.restaurant.name);
  });
}
