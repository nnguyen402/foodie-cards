import type { CuisineIconKind } from '../cards/themes';
import type { Coordinate } from './coordinates';

export type IdleMotion = 'spin' | 'steam' | 'flicker' | 'bounce' | 'bob' | 'pulse' | 'float';

const MOTIONS: Record<CuisineIconKind, IdleMotion> = {
  pizza: 'spin',
  coffee: 'steam',
  bbq: 'flicker',
  burger: 'bounce',
  sushi: 'bob',
  southern: 'pulse',
  plate: 'float',
};

export function idleMotion(icon: CuisineIconKind): IdleMotion {
  return MOTIONS[icon];
}

export type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };

export function inRegion(point: Coordinate, region: Region): boolean {
  return Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 && Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2;
}

export const MAX_ANIMATED_PINS = 8;

/** Collected pins on screen, nearest the centre first, up to the cap. Everything else stays still. */
export function animatedPinIds(pins: { id: string; coordinate: Coordinate; card: unknown | null }[], region: Region | null, cap = MAX_ANIMATED_PINS): Set<string> {
  if (!region) return new Set();
  const offCentre = (point: Coordinate) => Math.hypot(point.latitude - region.latitude, point.longitude - region.longitude);
  return new Set(
    pins
      .filter((pin) => pin.card !== null && inRegion(pin.coordinate, region))
      .sort((a, b) => offCentre(a.coordinate) - offCentre(b.coordinate))
      .slice(0, cap)
      .map((pin) => pin.id),
  );
}
