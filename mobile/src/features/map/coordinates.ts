// Where each catalog restaurant is. The restaurants table has no coordinate columns yet,
// so the seeded restaurants are placed from this table, keyed by restaurant id.
// Geocoded from the seed.sql addresses with OpenStreetMap Nominatim on 2026-10-10
// (© OpenStreetMap contributors, ODbL).

export type Coordinate = { latitude: number; longitude: number };

export const RESTAURANT_COORDINATES: Record<string, Coordinate> = {
  // Busy Bee Café, 810 Martin Luther King Jr Dr SW
  '10000000-0000-4000-8000-000000000001': { latitude: 33.75441, longitude: -84.413978 },
  // Fox Bros Bar-B-Q, 1238 DeKalb Ave NE
  '10000000-0000-4000-8000-000000000002': { latitude: 33.760998, longitude: -84.347424 },
  // Mary Mac's Tea Room, 224 Ponce de Leon Ave NE
  '10000000-0000-4000-8000-000000000003': { latitude: 33.772836, longitude: -84.379942 },
  // The Varsity, 61 North Ave NW
  '10000000-0000-4000-8000-000000000004': { latitude: 33.771707, longitude: -84.389315 },
  // Antico Pizza, 1093 Hemphill Ave NW
  '10000000-0000-4000-8000-000000000005': { latitude: 33.784655, longitude: -84.405616 },
};

export const ATLANTA_DOWNTOWN: Coordinate = { latitude: 33.749, longitude: -84.388 };
const isCoordinate = (latitude: unknown, longitude: unknown): boolean =>
  typeof latitude === 'number' && typeof longitude === 'number' && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

/** A restaurant's own stored coordinates when it has them, otherwise the lookup table. */
export function coordinateFor(restaurant: { id: string; latitude?: number | null; longitude?: number | null }): Coordinate | null {
  if (isCoordinate(restaurant.latitude, restaurant.longitude)) return { latitude: restaurant.latitude as number, longitude: restaurant.longitude as number };
  return RESTAURANT_COORDINATES[restaurant.id] ?? null;
}

export function distanceKm(a: Coordinate, b: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
