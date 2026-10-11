import { cuisineIcon, type CuisineIconKind } from '../cards/themes';
import type { CardView } from '../cards/types';
import { coordinateFor, type Coordinate } from './coordinates';

export type MapRestaurant = {
  id: string;
  name: string;
  neighbourhood: string;
  address: string;
  category: string;
  icon: CuisineIconKind;
  theme: CardView['restaurant']['theme'];
  coordinate: Coordinate;
  /** The user's card for this restaurant, or null when it is not collected yet. */
  card: CardView | null;
};

type Place = CardView['restaurant'] & { latitude?: number | null; longitude?: number | null };

function toPin(place: Place, card: MapRestaurant['card']): MapRestaurant | null {
  const coordinate = coordinateFor(place);
  if (!coordinate) return null;
  const [neighbourhood, address = ''] = place.locationLabel.split(' · ');
  return { id: place.id, name: place.name, neighbourhood, address, category: place.category, icon: cuisineIcon(place.category), theme: place.theme, coordinate, card };
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
