import { distanceKm, type Coordinate } from './coordinates';
import { DISCOVERY_RADIUS_METRES } from './discoveryArea';
import { normalizeOsm, overpassQuery, type OsmPlace } from './osm';

// A careful client for the public Overpass API. It keeps a session cache per discovery area,
// shares one request between simultaneous callers, tries the mirrors in order when one is
// busy or slow, rests an endpoint that rate limits us, and remembers the last good result
// on the device so a reload has something to show straight away.

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;
const USER_AGENT = 'FoodieCards/1.0 (Hacklanta student project; https://github.com/nnguyen402/foodie-cards)';
const CACHE_MS = 30 * 60 * 1000;
// A little longer than the 25 s the query allows the server.
const TIMEOUT_MS = 28 * 1000;
// A smaller circle to ask for when the server times out on the full one.
const REDUCED_RADIUS_METRES = 2000;
const REST_MS = 60 * 1000;
// A short, growing wait before moving on to the next mirror.
const NEXT_MIRROR_MS = 500;
const STORAGE_KEY = 'foodie-cards:map:nearby:v1';
// A saved result is reused when the player is still about where they were.
const SAME_AREA_KM = 0.5;
const NEARBY_AREA_KM = 1;

export class OverpassError extends Error {
  constructor(public reason: 'rate-limited' | 'failed', detail: string) {
    super(detail);
  }
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Saved = { centre: Coordinate; at: number; places: OsmPlace[] };
export type Restored = { places: OsmPlace[]; /** Recent and for this same spot, so no request is needed. */ fresh: boolean };

type Options = {
  fetcher: Fetcher;
  now?: () => number;
  storage?: Storage | null;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

// Areas whose centres round to the same ~10 m cell share a cache entry.
const areaKey = (centre: Coordinate) => `${centre.latitude.toFixed(4)},${centre.longitude.toFixed(4)}`;
const host = (endpoint: string) => endpoint.split('/')[2];

export function createNearbySource({ fetcher, now = Date.now, storage = null, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = () => {} }: Options) {
  const cache = new Map<string, { at: number; places: OsmPlace[] }>();
  const inFlight = new Map<string, Promise<OsmPlace[]>>();
  const restingUntil = new Map<string, number>();

  async function ask(endpoint: string, centre: Coordinate, radiusMetres = DISCOVERY_RADIUS_METRES): Promise<OsmPlace[]> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller?.abort();
    }, TIMEOUT_MS);
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(overpassQuery(centre, radiusMetres))}`,
        signal: controller?.signal,
      });
      if (response.status === 504 && radiusMetres > REDUCED_RADIUS_METRES) {
        // The server ran out of time: ask this endpoint once more for a smaller circle.
        log(`[nearby] ${host(endpoint)} failed: HTTP 504, retrying with ${REDUCED_RADIUS_METRES / 1000} km`);
        clearTimeout(timeout);
        return await ask(endpoint, centre, REDUCED_RADIUS_METRES);
      }
      if (response.status === 429 || response.status === 504) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        restingUntil.set(endpoint, now() + (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : REST_MS));
        throw new OverpassError('rate-limited', `HTTP ${response.status}`);
      }
      if (!response.ok) throw new OverpassError('failed', `HTTP ${response.status}`);
      return normalizeOsm(await response.json());
    } catch (error) {
      if (error instanceof OverpassError) throw error;
      throw new OverpassError('failed', timedOut ? `timeout after ${TIMEOUT_MS / 1000}s` : error instanceof Error ? error.message : 'network error');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request(centre: Coordinate): Promise<OsmPlace[]> {
    const available = OVERPASS_ENDPOINTS.filter((endpoint) => now() >= (restingUntil.get(endpoint) ?? 0));
    if (available.length === 0) {
      log('[nearby] every Overpass endpoint is resting after a rate limit; not asking again yet');
      throw new OverpassError('rate-limited', 'all endpoints resting');
    }
    let last: OverpassError | null = null;
    for (const [attempt, endpoint] of available.entries()) {
      if (attempt > 0) await sleep(NEXT_MIRROR_MS * attempt);
      try {
        return await ask(endpoint, centre);
      } catch (error) {
        last = error as OverpassError;
        log(`[nearby] ${host(endpoint)} failed: ${last.message}`);
      }
    }
    throw last ?? new OverpassError('failed', 'no endpoint tried');
  }

  async function save(centre: Coordinate, places: OsmPlace[]) {
    try {
      await storage?.setItem(STORAGE_KEY, JSON.stringify({ centre, at: now(), places } satisfies Saved));
    } catch (error) {
      log(`[nearby] could not save results: ${error instanceof Error ? error.message : 'storage error'}`);
    }
  }

  return {
    /** Cached places for this area, if a fresh copy exists, without touching the network. */
    cached(centre: Coordinate): OsmPlace[] | null {
      const hit = cache.get(areaKey(centre));
      return hit && now() - hit.at < CACHE_MS ? hit.places : null;
    },
    /** The last good result saved on this device, when it was for about this area. */
    async restore(centre: Coordinate): Promise<Restored | null> {
      try {
        const raw = await storage?.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
        if (!saved?.centre || !Array.isArray(saved.places) || typeof saved.at !== 'number') return null;
        const away = distanceKm(saved.centre, centre);
        if (away > NEARBY_AREA_KM) return null;
        const fresh = away <= SAME_AREA_KM && now() - saved.at < CACHE_MS;
        if (fresh) cache.set(areaKey(centre), { at: saved.at, places: saved.places });
        return { places: saved.places, fresh };
      } catch {
        return null;
      }
    },
    load(centre: Coordinate): Promise<OsmPlace[]> {
      const key = areaKey(centre);
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_MS) return Promise.resolve(hit.places);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const started = request(centre)
        .then((places) => {
          cache.set(key, { at: now(), places });
          void save(centre, places);
          return places;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, started);
      return started;
    },
  };
}

export type NearbySource = ReturnType<typeof createNearbySource>;
