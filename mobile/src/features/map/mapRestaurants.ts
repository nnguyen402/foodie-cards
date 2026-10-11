import { cuisineIcon, type CuisineIconKind } from '../cards/themes';
import type { CardView } from '../cards/types';
import { coordinateFor, type Coordinate } from './coordinates';

/** Lower-case, accent-free, punctuation-free, without a leading "the": "McDonald's" and "Mcdonalds" match. */
export const normalizedName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');

export type MapRestaurant = {
  /** One of our restaurant ids, or `osm:<type>/<id>` for a place we only know from OpenStreetMap. */
  id: string;
  source: 'catalog' | 'osm';
  osm: { type: 'node' | 'way' | 'relation'; id: number } | null;
  name: string;
  /**
   * What every location of one chain shares: `wikidata:<Q-id>` from OSM's brand:wikidata, else
   * `name:<normalised brand or name>`. Our own restaurants always use the name form. A backend
   * matching a receipt to a brand card can use this as the join key.
   */
  brandKey: string;
  neighbourhood: string;
  address: string;
  category: string;
  icon: CuisineIconKind;
  theme: CardView['restaurant']['theme'];
  coordinate: Coordinate;
  /** The user's card for this restaurant, or null when it is not collected yet. */
  card: CardView | null;
};

export type MapCardAvailability = 'view' | 'scan' | 'unavailable';

export function mapCardAvailability(pin: Pick<MapRestaurant, 'source' | 'card'>): MapCardAvailability {
  if (pin.card) return 'view';
  return pin.source === 'catalog' ? 'scan' : 'unavailable';
}

type Place = CardView['restaurant'] & { latitude?: number | null; longitude?: number | null };

function toPin(place: Place, card: MapRestaurant['card']): MapRestaurant | null {
  const coordinate = coordinateFor(place);
  if (!coordinate) return null;
  const [neighbourhood, address = ''] = place.locationLabel.split(' · ');
  return { id: place.id, source: 'catalog', osm: null, name: place.name, brandKey: `name:${normalizedName(place.name)}`, neighbourhood, address, category: place.category, icon: cuisineIcon(place.category), theme: place.theme, coordinate, card };
}

/** Every restaurant we can place on the map, collected or not, in name order. */
export function buildMapRestaurants(collection: { owned: CardView[]; locked: Place[] }): MapRestaurant[] {
  const pins = [
    ...collection.owned.map((card) => toPin(card.restaurant, card)),
    ...collection.locked.map((place) => toPin(place, null)),
  ];
  return pins.filter((pin): pin is MapRestaurant => pin !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export function discoveredCount(pins: MapRestaurant[]): number {
  return pins.filter((pin) => pin.card !== null).length;
}

/** Locations of one chain count once, so a brand with six branches in range is one restaurant. */
export function brandTotals(pins: MapRestaurant[]): { discovered: number; total: number } {
  const all = new Set(pins.map((pin) => pin.brandKey));
  const owned = new Set(pins.filter((pin) => pin.card).map((pin) => pin.brandKey));
  return { discovered: owned.size, total: all.size };
}
