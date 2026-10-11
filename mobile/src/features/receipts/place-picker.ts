// The confirm screen's restaurant picker, as pure functions: which place starts selected,
// what "Choose another" lists, how far away each place is, and where nearby places come from.
import { distanceKm, type Coordinate } from '../map/coordinates';
import { distanceLabel } from '../map/discoveryArea';
import type { NearbySource } from '../map/nearbySource';
import type { OsmPlace } from '../map/osm';
import type { UnlockTarget } from '../map/unlockTarget';
import { matchReceiptToPlace, type Candidate } from './match-place';
import { osmCandidate, unlockCandidate } from './place-choice';

/** Nearby places further than this from the user are not offered as matches. */
export const NEARBY_RADIUS_METRES = 500;
/** How long the confirm screen waits for a fresh nearby fetch before showing what it has. */
export const NEARBY_WAIT_MS = 8000;

export type SeededPlace = { id: string; name: string; coordinate: Coordinate | null };

export type PlacePick = {
  chosen: Candidate | null;
  /** What "Choose another" lists: nearby places first, then our seeded restaurants. */
  candidates: Candidate[];
  /** Open name search straight away: nothing was preselected, or there is no location to trust a match by. */
  searchOpen: boolean;
  /** Initial text of the search box. */
  searchQuery: string;
};

export const candidateKey = (candidate: Candidate) => (candidate.kind === 'seeded' ? `seeded:${candidate.restaurantId}` : candidate.place.key);

/** Adds candidates to a list, skipping any already in it. */
export function appendCandidates(list: Candidate[], extra: Candidate[]): Candidate[] {
  const seen = new Set(list.map(candidateKey));
  const added = extra.filter((candidate) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return added.length === 0 ? list : [...list, ...added];
}

export function searchCandidates(places: OsmPlace[]): Candidate[] {
  return places.map(osmCandidate);
}

export function initialPlacePick(input: {
  receiptName: string | null | undefined;
  /** The restaurant the receipt reader matched on the server, if any. */
  draftRestaurantId: string | null;
  user: Coordinate | null;
  nearby: OsmPlace[];
  seeded: SeededPlace[];
  unlock: UnlockTarget | null;
}): PlacePick {
  const { user, seeded, unlock } = input;
  const close = user ? input.nearby.filter((place) => distanceKm(user, place.coordinate) * 1000 <= NEARBY_RADIUS_METRES) : [];
  const match = matchReceiptToPlace({ receiptName: input.receiptName, user, nearby: close, seeded });
  const ranked = match.candidates.map((entry) => entry.candidate);
  // The place tapped on the map may be further away than the match radius, so look it up in everything fetched.
  const fromUnlock = unlock ? unlockCandidate(unlock, input.nearby, seeded) : null;
  const fromDraft = input.draftRestaurantId ? unlockCandidate({ restaurantId: input.draftRestaurantId }, [], seeded) : null;
  const picked = fromUnlock ?? match.preselected?.candidate ?? fromDraft;
  // Prefer the ranked copy of a seeded restaurant, which carries its coordinate for the distance label.
  const chosen = picked ? ranked.find((candidate) => candidateKey(candidate) === candidateKey(picked)) ?? picked : null;
  const nearbyFirst = [...ranked.filter((c) => c.kind === 'osm'), ...ranked.filter((c) => c.kind === 'seeded')];
  return {
    chosen,
    candidates: appendCandidates(chosen ? [chosen] : [], nearbyFirst),
    searchOpen: !chosen || (!user && !fromUnlock),
    searchQuery: input.receiptName?.trim() || unlock?.name || '',
  };
}

/** "0.1 mi" from the user to the place, or null without a location or a known position. */
export function candidateDistance(user: Coordinate | null, candidate: Candidate): string | null {
  return candidate.coordinate ? distanceLabel(user, candidate.coordinate) : null;
}

/**
 * The area name search is biased towards. Nominatim is a third party, so it gets the user's position
 * rounded to 0.1° (about 11 km), never the exact coordinate.
 */
export function searchBias(user: Coordinate | null): Coordinate | null {
  if (!user) return null;
  const round = (value: number) => Math.round(value * 10) / 10;
  return { latitude: round(user.latitude), longitude: round(user.longitude) };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Nearby places for the receipt, through the map's own Overpass client: its session cache, else the
 * result saved on the device, else one fresh fetch. Never throws and never waits longer than `waitMs`;
 * a failure or a slow server gives whatever was saved, or nothing.
 */
export async function nearbyForReceipt(
  source: Pick<NearbySource, 'cached' | 'restore' | 'load'>,
  centre: Coordinate,
  { waitMs = NEARBY_WAIT_MS, wait = sleep }: { waitMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<OsmPlace[]> {
  const cached = source.cached(centre);
  if (cached) return cached;
  const restored = await source.restore(centre).catch(() => null);
  if (restored?.fresh) return restored.places;
  const fallback = restored?.places ?? [];
  try {
    return await Promise.race([source.load(centre), wait(waitMs).then(() => fallback)]);
  } catch {
    return fallback;
  }
}
