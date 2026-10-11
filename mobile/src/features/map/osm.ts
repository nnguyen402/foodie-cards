import type { CuisineIconKind } from '../cards/themes';
import type { Coordinate } from './coordinates';

// Nearby restaurants from OpenStreetMap, via the Overpass API. Only what the map shows is
// kept: the OSM identity, name, position, cuisine and address. Nothing is filled in when
// OSM does not have it. Data © OpenStreetMap contributors, ODbL.

export type OsmPlace = {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  /** Namespaced so it can never be mistaken for one of our own restaurant ids. */
  key: string;
  name: string;
  coordinate: Coordinate;
  amenity: string;
  cuisine: string | null;
  address: string | null;
  city: string | null;
};

// Kept small so the shared servers answer quickly. Overpass cannot sort by distance, so in a
// very dense area these are not guaranteed to be the nearest places, only real ones in range.
const RESPONSE_LIMIT = 120;
const SERVER_TIMEOUT_SECONDS = 25;

export function overpassQuery(centre: Coordinate, radiusMetres: number): string {
  const around = `around:${radiusMetres},${centre.latitude},${centre.longitude}`;
  return `[out:json][timeout:${SERVER_TIMEOUT_SECONDS}];nwr["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](${around});out tags center ${RESPONSE_LIMIT};`;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const isOsmType = (value: unknown): value is OsmPlace['osmType'] => value === 'node' || value === 'way' || value === 'relation';

export function normalizeOsm(response: unknown): OsmPlace[] {
  const elements = (response as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  return elements.flatMap((raw): OsmPlace[] => {
    const element = raw as { type?: unknown; id?: unknown; lat?: unknown; lon?: unknown; center?: { lat?: unknown; lon?: unknown }; tags?: Record<string, unknown> };
    const tags = element.tags ?? {};
    const name = text(tags.name);
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!isOsmType(element.type) || typeof element.id !== 'number' || !name || typeof latitude !== 'number' || typeof longitude !== 'number') return [];
    const street = [text(tags['addr:housenumber']), text(tags['addr:street'])].filter(Boolean).join(' ');
    return [{
      osmType: element.type,
      osmId: element.id,
      key: `osm:${element.type}/${element.id}`,
      name,
      coordinate: { latitude, longitude },
      amenity: text(tags.amenity) ?? 'restaurant',
      // A cuisine tag can list several values; the first is the main one.
      cuisine: text(tags.cuisine)?.split(';')[0].trim().toLowerCase() || null,
      address: street === '' ? null : street,
      city: text(tags['addr:city']),
    }];
  });
}

const ICONS: Record<string, CuisineIconKind> = {
  pizza: 'pizza',
  italian_pizza: 'pizza',
  burger: 'burger',
  american: 'burger',
  hot_dog: 'burger',
  sandwich: 'burger',
  bbq: 'bbq',
  barbecue: 'bbq',
  steak_house: 'bbq',
  sushi: 'sushi',
  japanese: 'sushi',
  chicken: 'southern',
  fried_chicken: 'southern',
  southern: 'southern',
  soul_food: 'southern',
  coffee_shop: 'coffee',
  coffee: 'coffee',
  bubble_tea: 'coffee',
  tea: 'coffee',
};

export function osmIcon(cuisine: string | null, amenity: string): CuisineIconKind {
  return (cuisine ? ICONS[cuisine] : undefined) ?? (amenity === 'cafe' ? 'coffee' : 'plate');
}
