import { distanceKm, type Coordinate } from './coordinates';
import { inDiscoveryArea, type DiscoveryArea } from './discoveryArea';
import { normalizedName, type MapRestaurant } from './mapRestaurants';
import { cuisineIconFor, cuisineKeyFor } from '../cards/cuisineArt';
import type { OsmPlace } from './osm';

export const MAX_VISIBLE_RESTAURANTS = 40;
const SAME_PLACE_METRES = 150;
// OSM places have no theme of ours, so their preview uses neutral colours.
const NEUTRAL_THEME = { primaryColor: '#4A4744', accentColor: '#B4B1AE', fontKey: 'friendly', patternKey: 'none' } as MapRestaurant['theme'];

type Named = { name: string; coordinate: Coordinate };

/** Conservative: the same name, and close enough to be the same building rather than another branch. */
export function sameRestaurant(a: Named, b: Named): boolean {
  return normalizedName(a.name) === normalizedName(b.name) && distanceKm(a.coordinate, b.coordinate) * 1000 <= SAME_PLACE_METRES;
}

const nameKey = (place: OsmPlace) => `name:${normalizedName(place.brand ?? place.name)}`;
const brandKeyOf = (place: OsmPlace) => (place.brandWikidata ? `wikidata:${place.brandWikidata}` : nameKey(place));

/** The pin for one location. A location of a chain the user owns shows that brand's card. */
function toPin(place: OsmPlace, owned: Map<string, MapRestaurant>): MapRestaurant {
  const matchedBrandKey = brandKeyOf(place);
  const brandOwner = owned.get(matchedBrandKey) ?? owned.get(nameKey(place));
  const category = place.cuisine ?? place.amenity;
  const cuisine = cuisineKeyFor({ name: place.name, cuisine: place.cuisine, amenity: place.amenity });
  return {
    id: place.key,
    source: 'osm',
    osm: { type: place.osmType, id: place.osmId },
    name: place.name,
    // Catalog brands are name-keyed; reuse that canonical key for matched OSM aliases,
    // including branches whose OSM record carries a separate Wikidata id.
    brandKey: brandOwner?.brandKey ?? matchedBrandKey,
    neighbourhood: place.city ?? '',
    address: place.address ?? '',
    category,
    cuisine,
    icon: cuisineIconFor(cuisine),
    // The brand's own look when it is collected, so every branch glows the same colour.
    theme: brandOwner?.theme ?? NEUTRAL_THEME,
    coordinate: place.coordinate,
    card: brandOwner?.card ?? null,
  };
}

/**
 * What the map shows: all of our own restaurants (wherever they are), then the nearest
 * OpenStreetMap places inside the discovery area, without duplicates, up to the cap.
 */
export function mergeNearby(catalog: MapRestaurant[], places: OsmPlace[], area: DiscoveryArea): MapRestaurant[] {
  // Our own restaurants, the ones with real cards, are always on the map, whatever the radius.
  const ours = catalog;
  const kept: OsmPlace[] = [];
  const nearestFirst = places
    .filter((place) => inDiscoveryArea(place.coordinate, area))
    .map((place) => ({ place, distance: distanceKm(place.coordinate, area.centre) }))
    .sort((a, b) => a.distance - b.distance);
  for (const { place } of nearestFirst) {
    if (ours.length + kept.length >= MAX_VISIBLE_RESTAURANTS) break;
    if (ours.some((restaurant) => sameRestaurant(restaurant, place)) || kept.some((other) => sameRestaurant(other, place))) continue;
    kept.push(place);
  }
  // Collected brands from the whole catalog, not only those in range: the card is theirs wherever the branch is.
  const owned = new Map(catalog.filter((restaurant) => restaurant.card).map((restaurant) => [restaurant.brandKey, restaurant]));
  return [...ours.slice(0, MAX_VISIBLE_RESTAURANTS), ...kept.map((place) => toPin(place, owned))];
}
