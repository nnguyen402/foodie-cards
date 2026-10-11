import type { MapRestaurant } from './mapRestaurants';

// Which restaurant the Scan screen is for, passed from the map as route params so it can say
// "Unlocking: <name>". A seeded restaurant is identified by its id; a nearby-only place by its
// OpenStreetMap id, plus name and address, since it has no row of ours.

export type UnlockTarget = {
  name: string;
  /** One of our restaurant ids. Absent for a nearby-only place. */
  restaurantId?: string;
  address?: string;
  /** `node/123`, for a place we only know from OpenStreetMap. */
  osm?: string;
  /** The restaurant is already collected: this is another visit, not an unlock. */
  visit: boolean;
};

type Params = Record<string, string | string[] | undefined>;

export function unlockParams(restaurant: MapRestaurant): Record<string, string> {
  const params: Record<string, string> = { unlockName: restaurant.name };
  const address = [restaurant.address, restaurant.neighbourhood].filter(Boolean).join(', ');
  if (address) params.unlockAddress = address;
  if (restaurant.source === 'catalog') params.unlockId = restaurant.id;
  if (restaurant.osm) params.unlockOsm = `${restaurant.osm.type}/${restaurant.osm.id}`;
  if (restaurant.card) params.unlockVisit = '1';
  return params;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export function parseUnlockParams(params: Params): UnlockTarget | null {
  const name = first(params.unlockName);
  if (!name) return null;
  return {
    name,
    restaurantId: first(params.unlockId),
    address: first(params.unlockAddress),
    osm: first(params.unlockOsm),
    visit: first(params.unlockVisit) === '1',
  };
}
