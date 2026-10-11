import type { Coordinate } from './coordinates';
import { DISCOVERY_RADIUS_METRES } from './discoveryArea';
import { normalizeOsm, overpassQuery, type OsmPlace } from './osm';

// One careful client for the public Overpass API: a session cache per discovery area, one
// request shared by simultaneous callers, a timeout, and a pause after being rate limited.
// It is a free shared service, so there are no automatic retries and no second endpoint.

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'FoodieCards/1.0 (Hacklanta student project; https://github.com/nnguyen402/foodie-cards)';
const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 20 * 1000;
const BACKOFF_MS = 60 * 1000;

export class OverpassError extends Error {
  constructor(public reason: 'rate-limited' | 'failed') {
    super(reason === 'rate-limited' ? 'OpenStreetMap is busy. Try again in a minute.' : 'Nearby restaurants could not be loaded.');
  }
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

// Areas whose centres round to the same ~10 m cell share a cache entry.
const areaKey = (centre: Coordinate) => `${centre.latitude.toFixed(4)},${centre.longitude.toFixed(4)}`;

export function createNearbySource({ fetcher, now = Date.now }: { fetcher: Fetcher; now?: () => number }) {
  const cache = new Map<string, { at: number; places: OsmPlace[] }>();
  const inFlight = new Map<string, Promise<OsmPlace[]>>();
  let pausedUntil = 0;

  async function request(centre: Coordinate): Promise<OsmPlace[]> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(overpassQuery(centre, DISCOVERY_RADIUS_METRES))}`,
        signal: controller?.signal,
      });
      if (response.status === 429 || response.status === 504) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        pausedUntil = now() + (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS);
        throw new OverpassError('rate-limited');
      }
      if (!response.ok) throw new OverpassError('failed');
      return normalizeOsm(await response.json());
    } catch (error) {
      throw error instanceof OverpassError ? error : new OverpassError('failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    /** Cached places for this area, if a fresh copy exists, without touching the network. */
    cached(centre: Coordinate): OsmPlace[] | null {
      const hit = cache.get(areaKey(centre));
      return hit && now() - hit.at < CACHE_MS ? hit.places : null;
    },
    load(centre: Coordinate): Promise<OsmPlace[]> {
      const key = areaKey(centre);
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_MS) return Promise.resolve(hit.places);
      if (now() < pausedUntil) return Promise.reject(new OverpassError('rate-limited'));
      const pending = inFlight.get(key);
      if (pending) return pending;
      const started = request(centre)
        .then((places) => {
          cache.set(key, { at: now(), places });
          return places;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, started);
      return started;
    },
  };
}

export type NearbySource = ReturnType<typeof createNearbySource>;
