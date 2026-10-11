import type { ImageSourcePropType } from 'react-native';
import type { CuisineIconKind } from './themes';

// One cuisine key per restaurant, used for the label, the code-drawn icon, the optional art and
// the map token colour, so they can never disagree. Free text from OSM or the catalog goes
// through normalizeCuisine; nothing else decides what cuisine a restaurant is.

export const CUISINE_KEYS = ['burger', 'pizza', 'asian', 'mexican', 'bbq', 'chicken', 'coffee', 'dessert', 'breakfast', 'southern', 'seafood', 'default'] as const;
export type CuisineKey = (typeof CUISINE_KEYS)[number];

const TAGS: Record<string, CuisineKey> = {
  burger: 'burger', burgers: 'burger', hamburger: 'burger', american: 'burger', fast_food: 'burger', sandwich: 'burger', hot_dog: 'burger', diner: 'burger',
  pizza: 'pizza', pizzeria: 'pizza', italian_pizza: 'pizza',
  asian: 'asian', chinese: 'asian', japanese: 'asian', sushi: 'asian', thai: 'asian', vietnamese: 'asian', korean: 'asian', ramen: 'asian', noodle: 'asian', indian: 'asian', pho: 'asian', dim_sum: 'asian',
  mexican: 'mexican', tex_mex: 'mexican', tacos: 'mexican', taco: 'mexican', burrito: 'mexican',
  bbq: 'bbq', barbecue: 'bbq', barbeque: 'bbq', steak_house: 'bbq', steak: 'bbq', grill: 'bbq',
  chicken: 'chicken', wings: 'chicken', fried_chicken: 'chicken',
  cafe: 'coffee', coffee: 'coffee', coffee_shop: 'coffee', tea: 'coffee', bubble_tea: 'coffee',
  dessert: 'dessert', ice_cream: 'dessert', donut: 'dessert', doughnut: 'dessert', bakery: 'dessert', cake: 'dessert', frozen_yogurt: 'dessert', waffle: 'dessert',
  breakfast: 'breakfast', brunch: 'breakfast', pancake: 'breakfast', bagel: 'breakfast',
  southern: 'southern', soul_food: 'southern', soul: 'southern', cajun: 'southern', creole: 'southern',
  seafood: 'seafood', fish: 'seafood', fish_and_chips: 'seafood', oyster: 'seafood',
};

// Our seeded restaurants, by name, so they keep their cuisine even if a category is later reworded.
const SEEDED: Record<string, CuisineKey> = {
  'the varsity': 'burger',
  varsity: 'burger',
  'antico pizza': 'pizza',
  'fox bros bar b q': 'bbq',
  'fox bros bbq': 'bbq',
  'mary mac s tea room': 'southern',
  'busy bee cafe': 'southern',
};

const slug = (raw: string) => raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const spaced = (raw: string) => slug(raw).replace(/_/g, ' ');

/** "burger;american", "Tex-Mex", "coffee_shop" → one key. The first value OSM lists that we know wins. */
export function normalizeCuisine(raw: string | null | undefined): CuisineKey {
  if (!raw) return 'default';
  for (const part of raw.split(/[;,]/)) {
    const key = TAGS[slug(part)];
    if (key) return key;
  }
  return 'default';
}

/** A restaurant's cuisine: its name if it is one of ours, otherwise its category. */
export function cuisineKeyFor(restaurant: { name: string; category: string }): CuisineKey {
  return SEEDED[spaced(restaurant.name)] ?? normalizeCuisine(restaurant.category);
}

// The code-drawn fallback icon for each key. Several cuisines share a drawing for now.
const ICONS: Record<CuisineKey, CuisineIconKind> = {
  burger: 'burger', pizza: 'pizza', asian: 'sushi', mexican: 'plate', bbq: 'bbq', chicken: 'southern',
  coffee: 'coffee', dessert: 'plate', breakfast: 'coffee', southern: 'southern', seafood: 'sushi', default: 'plate',
};

export function cuisineIconFor(key: CuisineKey): CuisineIconKind {
  return ICONS[key];
}

// Colours for the map token: a ring, a deep fill behind the icon and the icon ink.
export type CuisineColors = { ring: string; fill: string; ink: string };
const COLORS: Record<CuisineKey, CuisineColors> = {
  burger: { ring: '#e8853a', fill: '#3a1d0b', ink: '#ffd9a8' },
  pizza: { ring: '#e5484d', fill: '#3b1316', ink: '#ffd0c9' },
  asian: { ring: '#3fb7a6', fill: '#0d2f2b', ink: '#c7f5ec' },
  mexican: { ring: '#8cc63f', fill: '#1f3010', ink: '#e4f7bf' },
  bbq: { ring: '#d2562b', fill: '#341308', ink: '#ffc9a8' },
  chicken: { ring: '#f2b632', fill: '#3a2807', ink: '#ffe9a6' },
  coffee: { ring: '#b9825a', fill: '#2c1a10', ink: '#f2d9c0' },
  dessert: { ring: '#ec6fb1', fill: '#3a1228', ink: '#ffd3ec' },
  breakfast: { ring: '#f5d13d', fill: '#3a3009', ink: '#fff2a6' },
  southern: { ring: '#c9772e', fill: '#33200c', ink: '#ffddb0' },
  seafood: { ring: '#4aa3df', fill: '#0f2a3d', ink: '#cfeaff' },
  default: { ring: '#a99b8a', fill: '#2a241d', ink: '#f2e6d6' },
};

export function cuisineColors(key: CuisineKey): CuisineColors {
  return COLORS[key];
}

// Illustrations that exist in mobile/assets/cuisine/. Add a line when a file is committed.
// Loaders, not values, so the images are only required where the app (Metro) asks for them.
const ART: Partial<Record<CuisineKey, () => ImageSourcePropType>> = {
  chicken: () => require('../../../assets/cuisine/chicken.png'),
  southern: () => require('../../../assets/cuisine/southern.png'),
  seafood: () => require('../../../assets/cuisine/seafood.png'),
};

export function hasCuisineArt(key: CuisineKey): boolean {
  return ART[key] !== undefined;
}

/** The prepared image for a cuisine, or null to fall back to the drawn icon. */
export function getCuisineArt(key: CuisineKey): ImageSourcePropType | null {
  return ART[key]?.() ?? null;
}
