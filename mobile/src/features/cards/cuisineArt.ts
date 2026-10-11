import type { ImageSourcePropType } from 'react-native';
import type { CuisineIconKind } from './themes';

// One cuisine key per restaurant, used for the label, the code-drawn icon, the optional art and
// the map token colour, so they can never disagree. It is worked out in one place, from
// generic food words only (cuisine tags, then words in the name, then amenity=cafe). When
// none of those say what the food is, the key is 'default' and there is no art: never a guess.

export const CUISINE_KEYS = ['burger', 'pizza', 'asian', 'mexican', 'bbq', 'chicken', 'coffee', 'dessert', 'breakfast', 'southern', 'seafood', 'steak', 'japanese', 'default'] as const;
export type CuisineKey = (typeof CUISINE_KEYS)[number];

// OSM cuisine tag values (and our catalog categories, which use the same words).
const TAGS: Record<string, CuisineKey> = {
  burger: 'burger', burgers: 'burger', hamburger: 'burger',
  pizza: 'pizza', pizzeria: 'pizza', italian_pizza: 'pizza',
  asian: 'asian', chinese: 'asian', thai: 'asian', vietnamese: 'asian', korean: 'asian', noodle: 'asian', pho: 'asian', dim_sum: 'asian',
  mexican: 'mexican', tex_mex: 'mexican', tacos: 'mexican', taco: 'mexican', burrito: 'mexican',
  bbq: 'bbq', barbecue: 'bbq', barbeque: 'bbq',
  steak: 'steak', steak_house: 'steak', steakhouse: 'steak',
  japanese: 'japanese', sushi: 'japanese', ramen: 'japanese',
  chicken: 'chicken', wings: 'chicken', fried_chicken: 'chicken',
  cafe: 'coffee', coffee: 'coffee', coffee_shop: 'coffee',
  dessert: 'dessert', ice_cream: 'dessert', donut: 'dessert', doughnut: 'dessert', bakery: 'dessert', cake: 'dessert', frozen_yogurt: 'dessert',
  breakfast: 'breakfast', brunch: 'breakfast', pancake: 'breakfast', waffle: 'breakfast', bagel: 'breakfast',
  southern: 'southern', soul_food: 'southern', soul: 'southern', cajun: 'southern', creole: 'southern',
  seafood: 'seafood', fish: 'seafood', fish_and_chips: 'seafood', oyster: 'seafood',
};

// Generic food words in a restaurant's name, in priority order. Whole words only ("pho" does
// not match "photo"), with or without a plural "s". No brand names, ever.
const NAME_WORDS: [CuisineKey, string[]][] = [
  ['pizza', ['pizza', 'pizzeria']],
  ['mexican', ['taco', 'taqueria', 'cantina', 'burrito', 'mexican', 'tex mex']],
  ['japanese', ['sushi', 'ramen', 'japanese']],
  ['asian', ['pho', 'thai', 'wok', 'noodle', 'dumpling', 'asian', 'chinese', 'korean']],
  ['bbq', ['bbq', 'barbecue', 'smokehouse']],
  ['chicken', ['wing', 'chicken']],
  ['burger', ['burger']],
  ['coffee', ['coffee', 'cafe', 'espresso', 'roast', 'roaster', 'roastery']],
  ['breakfast', ['pancake', 'waffle', 'breakfast', 'diner']],
  ['steak', ['steak', 'steakhouse']],
  ['seafood', ['seafood', 'oyster', 'crab', 'fish']],
  ['dessert', ['bakery', 'dessert', 'ice cream', 'donut', 'doughnut']],
];

const slug = (raw: string) => raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** "burger;american", "Tex-Mex", "coffee_shop" → one key. The first value OSM lists that we know wins. */
export function normalizeCuisine(raw: string | null | undefined): CuisineKey {
  if (!raw) return 'default';
  for (const part of raw.split(/[;,]/)) {
    const key = TAGS[slug(part)];
    if (key) return key;
  }
  return 'default';
}

function cuisineFromName(name: string): CuisineKey {
  const words = ` ${slug(name).replace(/_/g, ' ')} `;
  for (const [key, list] of NAME_WORDS) {
    if (list.some((word) => words.includes(` ${word} `) || words.includes(` ${word}s `))) return key;
  }
  return 'default';
}

export type CuisineSource = {
  name: string;
  /** OSM cuisine tag, or our catalog category: both use the same words. */
  cuisine?: string | null;
  /** OSM amenity, when the place came from OpenStreetMap. */
  amenity?: string | null;
};

/** The one cuisine decision: cuisine tags, then words in the name, then amenity=cafe, otherwise 'default' (no art). */
export function cuisineKeyFor({ name, cuisine, amenity }: CuisineSource): CuisineKey {
  const fromTag = normalizeCuisine(cuisine);
  if (fromTag !== 'default') return fromTag;
  const fromName = cuisineFromName(name);
  if (fromName !== 'default') return fromName;
  return amenity === 'cafe' ? 'coffee' : 'default';
}

// The code-drawn fallback icon for each key. Several cuisines share a drawing for now.
const ICONS: Record<CuisineKey, CuisineIconKind> = {
  burger: 'burger', pizza: 'pizza', asian: 'sushi', mexican: 'plate', bbq: 'bbq', chicken: 'southern',
  coffee: 'coffee', dessert: 'plate', breakfast: 'coffee', southern: 'southern', seafood: 'sushi', steak: 'bbq', japanese: 'sushi', default: 'plate',
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
  steak: { ring: '#b0343f', fill: '#2f0c10', ink: '#ffcfc9' },
  japanese: { ring: '#8a7be0', fill: '#1d1840', ink: '#dcd6ff' },
  default: { ring: '#a99b8a', fill: '#2a241d', ink: '#f2e6d6' },
};

export function cuisineColors(key: CuisineKey): CuisineColors {
  return COLORS[key];
}

// Illustrations that exist in mobile/assets/cuisine/. Each cuisine has two files: a 320px PNG
// for the round map tokens and a wider <key>-card.jpg (720px, cropped to the card's art
// window) for the card. Add both when a new one is committed. Loaders, not values, so the
// images are only required where the app (Metro) asks for them.
type Art = { token: () => ImageSourcePropType; card: () => ImageSourcePropType };
const ART: Partial<Record<CuisineKey, Art>> = {
  burger: { token: () => require('../../../assets/cuisine/burger.png'), card: () => require('../../../assets/cuisine/burger-card.jpg') },
  mexican: { token: () => require('../../../assets/cuisine/mexican.png'), card: () => require('../../../assets/cuisine/mexican-card.jpg') },
  dessert: { token: () => require('../../../assets/cuisine/dessert.png'), card: () => require('../../../assets/cuisine/dessert-card.jpg') },
  pizza: { token: () => require('../../../assets/cuisine/pizza.png'), card: () => require('../../../assets/cuisine/pizza-card.jpg') },
  asian: { token: () => require('../../../assets/cuisine/asian.png'), card: () => require('../../../assets/cuisine/asian-card.jpg') },
  breakfast: { token: () => require('../../../assets/cuisine/breakfast.png'), card: () => require('../../../assets/cuisine/breakfast-card.jpg') },
  coffee: { token: () => require('../../../assets/cuisine/coffee.png'), card: () => require('../../../assets/cuisine/coffee-card.jpg') },
  chicken: { token: () => require('../../../assets/cuisine/chicken.png'), card: () => require('../../../assets/cuisine/chicken-card.jpg') },
  southern: { token: () => require('../../../assets/cuisine/southern.png'), card: () => require('../../../assets/cuisine/southern-card.jpg') },
  seafood: { token: () => require('../../../assets/cuisine/seafood.png'), card: () => require('../../../assets/cuisine/seafood-card.jpg') },
  steak: { token: () => require('../../../assets/cuisine/steak.png'), card: () => require('../../../assets/cuisine/steak-card.jpg') },
  japanese: { token: () => require('../../../assets/cuisine/japanese.png'), card: () => require('../../../assets/cuisine/japanese-card.jpg') },
};

export function hasCuisineArt(key: CuisineKey): boolean {
  return ART[key] !== undefined;
}

/** The round-token image for a cuisine, or null to fall back to the drawn icon. */
export function getCuisineArt(key: CuisineKey): ImageSourcePropType | null {
  return ART[key]?.token() ?? null;
}

/** The card-window image for a cuisine, or null to fall back to the drawn icon. */
export function getCuisineCardArt(key: CuisineKey): ImageSourcePropType | null {
  return ART[key]?.card() ?? null;
}
