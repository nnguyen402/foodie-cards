import { ATLANTA_DOWNTOWN, distanceKm, type Coordinate } from './coordinates';

// The map only shows restaurants inside a fixed circle around the player. It is a search
// boundary for the map, not a rule about which receipts can be scanned.
export const DISCOVERY_RADIUS_METRES = 5000;

/** How far the map's centre must drift from the discovery circle's centre before "Search this area" is offered. */
export const SEARCH_THIS_AREA_METRES = 1000;

export type DiscoveryArea = { centre: Coordinate; /** True when no real location is available and the area is downtown Atlanta. */ fallback: boolean };

export function discoveryArea(user: Coordinate | null): DiscoveryArea {
  return user ? { centre: user, fallback: false } : { centre: ATLANTA_DOWNTOWN, fallback: true };
}

export function inDiscoveryArea(point: Coordinate, area: DiscoveryArea): boolean {
  return distanceKm(point, area.centre) * 1000 <= DISCOVERY_RADIUS_METRES;
}

const KM_PER_MILE = 1.609344;

/** "0.8 mi", or feet when very close. Null when there is no real player position to measure from. */
export function distanceLabel(from: Coordinate | null, to: Coordinate): string | null {
  if (!from) return null;
  const miles = distanceKm(from, to) / KM_PER_MILE;
  if (miles < 0.1) return `${Math.max(10, Math.round((miles * 5280) / 10) * 10)} ft`;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function areaLabel(area: DiscoveryArea, placeName: string | null): string {
  if (area.fallback) return 'Downtown Atlanta · location off';
  return placeName ?? 'Your area';
}

export function offerSearchHere(mapCentre: Coordinate, area: DiscoveryArea): boolean {
  return distanceKm(mapCentre, area.centre) * 1000 > SEARCH_THIS_AREA_METRES;
}
