// Finds restaurants by name with OpenStreetMap's Nominatim. Called only on a user action, cached,
// and spaced one second apart as the usage policy requires. Data © OpenStreetMap contributors, ODbL.
import type { Coordinate } from '../map/coordinates';
import { normalizedName } from '../map/mapRestaurants';
import type { OsmPlace } from '../map/osm';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const VIEWBOX_DEGREES = 0.5;
const MIN_GAP_MS = 1000;
const HEADERS = { 'User-Agent': 'FoodieCards/1.0 (jamesafon4@gmail.com)', Accept: 'application/json' };

export function nominatimUrl(query: string, near: Coordinate | null): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('q', query);
  if (near) {
    const { latitude: lat, longitude: lon } = near;
    // viewbox is left,top,right,bottom; bounded=0 keeps it a bias rather than a filter.
    url.searchParams.set('viewbox', [lon - VIEWBOX_DEGREES, lat + VIEWBOX_DEGREES, lon + VIEWBOX_DEGREES, lat - VIEWBOX_DEGREES].join(','));
    url.searchParams.set('bounded', '0');
  }
  return url.toString();
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const isOsmType = (value: unknown): value is OsmPlace['osmType'] => value === 'node' || value === 'way' || value === 'relation';

export function mapNominatim(response: unknown): OsmPlace[] {
  if (!Array.isArray(response)) return [];
  return response.flatMap((raw): OsmPlace[] => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const latitude = parseFloat(String(row.lat));
    const longitude = parseFloat(String(row.lon));
    const name = text(row.name) ?? text(text(row.display_name)?.split(',')[0]);
    if (!isOsmType(row.osm_type) || typeof row.osm_id !== 'number' || !Number.isInteger(row.osm_id) || row.osm_id <= 0 || !name) return [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    const parts = row.address && typeof row.address === 'object' ? (row.address as Record<string, unknown>) : {};
    const street = [text(parts.house_number), text(parts.road)].filter(Boolean).join(' ');
    return [{
      osmType: row.osm_type,
      osmId: row.osm_id,
      key: `osm:${row.osm_type}/${row.osm_id}`,
      name,
      coordinate: { latitude, longitude },
      amenity: row.category === 'amenity' ? text(row.type) ?? 'restaurant' : 'restaurant',
      cuisine: null,
      address: street === '' ? null : street,
      city: text(parts.city) ?? text(parts.town) ?? text(parts.village),
      brand: null,
      brandWikidata: null,
    }];
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createPlaceSearch(fetcher: typeof fetch = fetch, now: () => number = Date.now, wait: (ms: number) => Promise<void> = sleep) {
  const cache = new Map<string, OsmPlace[]>();
  let lastAt = -Infinity;
  return async (query: string, near: Coordinate | null, signal?: AbortSignal): Promise<OsmPlace[]> => {
    const key = normalizedName(query);
    const cached = cache.get(key);
    if (cached) return cached;
    const delay = Math.max(0, MIN_GAP_MS - (now() - lastAt));
    if (delay > 0) await wait(delay);
    lastAt = now();
    const response = await fetcher(nominatimUrl(query.trim(), near), { headers: HEADERS, signal });
    if (!response.ok) throw new Error('Place search is unavailable right now.');
    const places = mapNominatim(await response.json().catch(() => null));
    cache.set(key, places);
    return places;
  };
}
