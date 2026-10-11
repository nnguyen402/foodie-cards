import snapshot from './offlineSnapshot.json';
import { distanceKm, type Coordinate } from './coordinates';
import { DISCOVERY_RADIUS_METRES } from './discoveryArea';
import type { OsmPlace } from './osm';

// OFFLINE SNAPSHOT. Real OpenStreetMap restaurants around Georgia State University in
// downtown Atlanta, fetched once and committed, so the map still has nearby places when every
// Overpass endpoint is down and nothing has been saved on the device yet. It is a last
// resort: a live or saved result always wins, and it is never written back to storage.
// It holds the 200 named places nearest the centre (see coverageMetres in the JSON), not
// the full discovery area. Data © OpenStreetMap contributors, ODbL.
export const OFFLINE_SNAPSHOT = snapshot as { label: string; source: string; osmBase: string; centre: Coordinate; coverageMetres: number; places: OsmPlace[] };

/** Snapshot places inside the discovery area around `centre`; empty anywhere the snapshot does not reach. */
export function offlinePlaces(centre: Coordinate): OsmPlace[] {
  return OFFLINE_SNAPSHOT.places.filter((place) => distanceKm(place.coordinate, centre) * 1000 <= DISCOVERY_RADIUS_METRES);
}
