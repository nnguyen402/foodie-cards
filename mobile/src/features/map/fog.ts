import type { Coordinate } from './coordinates';

const METRES_PER_DEGREE = 111_320;

/** Points around a circle on the ground. */
export function circleRing(centre: Coordinate, radiusMetres: number, points = 24): Coordinate[] {
  const latitudeReach = radiusMetres / METRES_PER_DEGREE;
  const longitudeReach = radiusMetres / (METRES_PER_DEGREE * Math.cos((centre.latitude * Math.PI) / 180));
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    return { latitude: centre.latitude + Math.sin(angle) * latitudeReach, longitude: centre.longitude + Math.cos(angle) * longitudeReach };
  });
}
