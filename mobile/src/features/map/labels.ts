// Wording for the map's restaurant panels. Flavour lines describe a kind of food in general
// terms; they are not claims about a particular restaurant.

export function categoryLabel(category: string): string {
  const words = category.trim().replace(/[_-]+/g, ' ').toLowerCase();
  return words === '' ? 'Restaurant' : words[0].toUpperCase() + words.slice(1);
}

const FLAVOUR: Record<string, string> = {
  soul_food: 'Soul on a plate, made with patience.',
  cafe: 'Slow mornings, strong pours.',
  barbecue: 'Low, slow and smoky.',
  southern: 'Comfort food, the long way round.',
  fast_food: 'Hot, fast and wrapped in paper.',
  pizza: 'Blistered crust, molten middle.',
  sushi: 'Clean cuts, quiet focus.',
  japanese: 'Clean cuts, quiet focus.',
};

export function flavourLine(category: string): string {
  return FLAVOUR[category.trim().toLowerCase()] ?? 'A table worth coming back to.';
}
