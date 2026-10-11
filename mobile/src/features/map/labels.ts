import type { CuisineKey } from '../cards/cuisineArt';

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

// A game-style ability line per cuisine. Display only: no XP is calculated from these.
const ABILITY: Record<CuisineKey, string> = {
  burger: 'Grill Master — +25% XP on repeat visits',
  pizza: 'Slice Spinner — bonus XP when you share a pie',
  asian: 'Noodle Ninja — bonus XP for trying a new dish',
  mexican: 'Fiesta Fuel — bonus XP on taco night',
  bbq: 'Smoke Signal — +20% XP on weekend visits',
  chicken: 'Crispy Combo — bonus XP on every third visit',
  coffee: 'Morning Boost — bonus XP before 11am',
  dessert: 'Sweet Tooth — bonus XP on dessert orders',
  breakfast: 'Early Bird — bonus XP before 10am',
  southern: 'Comfort Streak — bonus XP on back-to-back visits',
  seafood: 'Catch of the Day — bonus XP on a new dish',
  steak: 'Prime Cut — +20% XP on dinner visits',
  japanese: 'Blade Master — bonus XP for trying something new',
  default: 'Local Legend — earn XP on every visit',
};

export function abilityLine(cuisine: CuisineKey): string {
  return ABILITY[cuisine];
}
