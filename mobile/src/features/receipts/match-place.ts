// Ranks nearby OpenStreetMap places and seeded restaurants against a receipt's restaurant name.
import { distanceKm, type Coordinate } from '../map/coordinates';
import { normalizedName } from '../map/mapRestaurants';
import type { OsmPlace } from '../map/osm';

export type Candidate =
  | { kind: 'seeded'; restaurantId: string; name: string; brandKey: string; coordinate: Coordinate | null }
  | { kind: 'osm'; place: OsmPlace; name: string; brandKey: string; coordinate: Coordinate };
export type RankedCandidate = { candidate: Candidate; nameScore: number; distanceM: number | null };

const PRESELECT_SCORE = 0.8;
const PRESELECT_METERS = 300;

export function brandKeyFor(place: Pick<OsmPlace, 'name' | 'brand' | 'brandWikidata'>): string {
  if (place.brandWikidata) return `wikidata:${place.brandWikidata}`;
  return `name:${normalizedName(place.brand || place.name)}`;
}

// Store numbers ("#01234") are all-digit tokens; they must not lower the score.
const tokens = (name: string): string[] => normalizedName(name).split(' ').filter((t) => t !== '' && !/^\d+$/.test(t));

function nameScore(receiptName: string | null | undefined, candidate: string, candidateBrandKey: string): number {
  if (!receiptName) return 0;
  const a = tokens(receiptName);
  const b = tokens(candidate);
  if (a.length === 0 || b.length === 0) return 0;
  // Joined comparison makes "Mcdonalds" equal "McDonald's" (tokens "mcdonald", "s").
  if (a.join(' ') === b.join(' ') || a.join('') === b.join('')) return 1;
  if (`name:${a.join(' ')}` === candidateBrandKey) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.every((t) => long.includes(t))) return 0.8;
  const shared = a.filter((t) => b.includes(t)).length;
  return shared / Math.max(a.length, b.length);
}

const byDistance = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b);

export function matchReceiptToPlace(input: {
  receiptName: string | null | undefined; user: Coordinate | null; nearby: OsmPlace[];
  seeded: { id: string; name: string; coordinate: Coordinate | null }[];
}): { preselected: RankedCandidate | null; candidates: RankedCandidate[] } {
  const all: Candidate[] = [
    ...input.seeded.map((s): Candidate => ({ kind: 'seeded', restaurantId: s.id, name: s.name, brandKey: `name:${normalizedName(s.name)}`, coordinate: s.coordinate })),
    ...input.nearby.map((place): Candidate => ({ kind: 'osm', place, name: place.name, brandKey: brandKeyFor(place), coordinate: place.coordinate })),
  ];
  const candidates = all.map((candidate): RankedCandidate => ({
    candidate,
    nameScore: nameScore(input.receiptName, candidate.name, candidate.brandKey),
    distanceM: input.user && candidate.coordinate ? distanceKm(input.user, candidate.coordinate) * 1000 : null,
  })).sort((a, b) => b.nameScore - a.nameScore || byDistance(a.distanceM, b.distanceM));

  const preselected = candidates
    .filter((c) => c.nameScore >= PRESELECT_SCORE && (c.distanceM !== null ? c.distanceM <= PRESELECT_METERS : c.candidate.kind === 'seeded'))
    .sort((a, b) => byDistance(a.distanceM, b.distanceM))[0] ?? null;
  return { preselected, candidates };
}
