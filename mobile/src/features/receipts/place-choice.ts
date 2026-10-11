// Turns the picked candidate into the receipt submit payload, and the map's unlock params into a candidate.
import type { Place } from '@foodie-cards/shared';
import { normalizedName } from '../map/mapRestaurants';
import type { OsmPlace } from '../map/osm';
import type { UnlockTarget } from '../map/unlockTarget';
import { brandKeyFor, type Candidate } from './match-place';

/** A nearby or searched OpenStreetMap place as a pickable candidate. */
export function osmCandidate(place: OsmPlace): Candidate {
  return { kind: 'osm', place, name: place.name, brandKey: brandKeyFor(place), coordinate: place.coordinate };
}

export function submitTargetFor(candidate: Candidate): { restaurantId: string } | { place: Place } {
  if (candidate.kind === 'seeded') return { restaurantId: candidate.restaurantId };
  const { place } = candidate;
  const address = [place.address, place.city].filter(Boolean).join(', ');
  return {
    place: {
      osmType: place.osmType,
      osmId: place.osmId,
      name: place.name,
      ...(address ? { address } : {}),
      brandKey: brandKeyFor(place),
      ...(place.cuisine ? { cuisine: place.cuisine } : {}),
      latitude: place.coordinate.latitude,
      longitude: place.coordinate.longitude,
    },
  };
}

/** Only the identity fields of the map's unlock target matter here: our restaurant id, or an OSM key like `node/42`. */
export function unlockCandidate(target: Pick<UnlockTarget, 'restaurantId' | 'osm'>, nearby: OsmPlace[], seeded: { id: string; name: string }[]): Candidate | null {
  if (target.restaurantId) {
    const row = seeded.find((s) => s.id === target.restaurantId);
    if (row) return { kind: 'seeded', restaurantId: row.id, name: row.name, brandKey: `name:${normalizedName(row.name)}`, coordinate: null };
  }
  if (target.osm) {
    const place = nearby.find((p) => `${p.osmType}/${p.osmId}` === target.osm);
    if (place) return osmCandidate(place);
  }
  return null;
}
