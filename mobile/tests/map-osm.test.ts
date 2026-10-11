import { describe, expect, it } from 'vitest';
import { normalizeOsm, osmIcon, overpassQuery } from '../src/features/map/osm';
import { MAX_VISIBLE_RESTAURANTS, mergeNearby, sameRestaurant } from '../src/features/map/mergeNearby';
import { createNearbySource, OverpassError } from '../src/features/map/nearbySource';
import { discoveryArea } from '../src/features/map/discoveryArea';
import type { MapRestaurant } from '../src/features/map/mapRestaurants';

const suwanee = { latitude: 34.0515, longitude: -84.0713 };
const area = discoveryArea(suwanee);
const north = (metres: number) => ({ latitude: suwanee.latitude + metres / 111320, longitude: suwanee.longitude });

const element = (over: Record<string, unknown>) => ({ type: 'node', id: 1, lat: suwanee.latitude, lon: suwanee.longitude, tags: { amenity: 'restaurant', name: 'Test Kitchen' }, ...over });

describe('overpassQuery', () => {
  it('asks for named restaurants, fast food and cafes around the centre', () => {
    const query = overpassQuery(suwanee, 5000);
    expect(query).toContain('nwr["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](around:5000,34.0515,-84.0713)');
    expect(query).toContain('out tags center');
  });
});

describe('normalizeOsm', () => {
  it('keeps the namespaced id, name, coordinates, cuisine and address of a node', () => {
    const [place] = normalizeOsm({ elements: [element({ id: 42, tags: { amenity: 'restaurant', name: 'Pho Corner', cuisine: 'vietnamese;noodle', 'addr:housenumber': '310', 'addr:street': 'Main St', 'addr:city': 'Suwanee' } })] });
    expect(place).toEqual({ osmType: 'node', osmId: 42, key: 'osm:node/42', name: 'Pho Corner', coordinate: suwanee, amenity: 'restaurant', cuisine: 'vietnamese', address: '310 Main St', city: 'Suwanee' });
  });

  it('uses the centre of a way or relation', () => {
    const [place] = normalizeOsm({ elements: [{ type: 'way', id: 7, center: { lat: 34.06, lon: -84.08 }, tags: { amenity: 'cafe', name: 'Bean Hall' } }] });
    expect(place).toMatchObject({ key: 'osm:way/7', coordinate: { latitude: 34.06, longitude: -84.08 }, cuisine: null, address: null, city: null });
  });

  it('drops elements without a name or coordinates and never invents details', () => {
    const places = normalizeOsm({ elements: [element({ tags: { amenity: 'restaurant' } }), { type: 'way', id: 9, tags: { amenity: 'cafe', name: 'No Centre' } }, element({ id: 3, tags: { amenity: 'fast_food', name: '  ' } })] });
    expect(places).toEqual([]);
  });

  it('survives a malformed response', () => {
    expect(normalizeOsm(null)).toEqual([]);
    expect(normalizeOsm({ elements: 'nope' })).toEqual([]);
  });
});

describe('osmIcon', () => {
  it('maps the cuisine tag to one of our icons', () => {
    expect(osmIcon('pizza', 'restaurant')).toBe('pizza');
    expect(osmIcon('burger', 'fast_food')).toBe('burger');
    expect(osmIcon('bbq', 'restaurant')).toBe('bbq');
    expect(osmIcon('sushi', 'restaurant')).toBe('sushi');
    expect(osmIcon('chicken', 'fast_food')).toBe('southern');
    expect(osmIcon('coffee_shop', 'cafe')).toBe('coffee');
  });

  it('falls back to coffee for a cafe and the plate otherwise', () => {
    expect(osmIcon(null, 'cafe')).toBe('coffee');
    expect(osmIcon('vietnamese', 'restaurant')).toBe('plate');
    expect(osmIcon(null, 'restaurant')).toBe('plate');
  });
});

const osmPlace = (id: number, name: string, metresNorth: number) => normalizeOsm({ elements: [element({ id, lat: north(metresNorth).latitude, tags: { amenity: 'restaurant', name } })] })[0];
const seeded = (name: string, metresNorth: number): MapRestaurant => ({
  id: `seed-${name}`, source: 'catalog', osm: null, name, neighbourhood: 'Town', address: '1 Main St', category: 'pizza', icon: 'pizza',
  theme: { primaryColor: '#000000', accentColor: '#ffffff', fontKey: 'bold', patternKey: 'none' } as MapRestaurant['theme'], coordinate: north(metresNorth), card: null,
});

describe('sameRestaurant', () => {
  it('matches the same name within about 150 m, ignoring case, accents, punctuation and a leading "the"', () => {
    expect(sameRestaurant({ name: 'The Varsity', coordinate: north(0) }, { name: 'varsity', coordinate: north(120) })).toBe(true);
    expect(sameRestaurant({ name: 'Busy Bee Café', coordinate: north(0) }, { name: 'Busy Bee Cafe', coordinate: north(50) })).toBe(true);
  });

  it('does not merge another branch with the same name further away, or a different name next door', () => {
    expect(sameRestaurant({ name: 'The Varsity', coordinate: north(0) }, { name: 'The Varsity', coordinate: north(400) })).toBe(false);
    expect(sameRestaurant({ name: 'The Varsity', coordinate: north(0) }, { name: 'Varsity Jr', coordinate: north(10) })).toBe(false);
  });
});

describe('mergeNearby', () => {
  it('keeps only places inside the 5 km circle, by real distance', () => {
    const merged = mergeNearby([], [osmPlace(1, 'Near', 4900), osmPlace(2, 'Far', 5200)], area);
    expect(merged.map((pin) => pin.name)).toEqual(['Near']);
  });

  it('folds an OSM duplicate into the seeded restaurant and keeps the seeded identity', () => {
    const merged = mergeNearby([seeded('Antico Pizza', 100)], [osmPlace(1, 'Antico Pizza', 160), osmPlace(2, 'Other Place', 300)], area);
    expect(merged.map((pin) => pin.id)).toEqual(['seed-Antico Pizza', 'osm:node/2']);
  });

  it('drops a second OSM record of the same place', () => {
    const merged = mergeNearby([], [osmPlace(1, 'Bean Hall', 200), osmPlace(2, 'Bean Hall', 215)], area);
    expect(merged).toHaveLength(1);
  });

  it('shows OSM places as uncollected, with no card, sorted nearest first', () => {
    const merged = mergeNearby([], [osmPlace(1, 'Second', 900), osmPlace(2, 'First', 300)], area);
    expect(merged.map((pin) => pin.name)).toEqual(['First', 'Second']);
    expect(merged[0]).toMatchObject({ source: 'osm', osm: { type: 'node', id: 2 }, card: null, icon: 'plate' });
  });

  it('caps the visible set at 40, seeded first, then the nearest OSM places', () => {
    const many = Array.from({ length: 60 }, (_, index) => osmPlace(index + 1, `Place ${index + 1}`, 100 + index * 50));
    const merged = mergeNearby([seeded('Seeded Far', 4000)], many, area);
    expect(MAX_VISIBLE_RESTAURANTS).toBe(40);
    expect(merged).toHaveLength(40);
    expect(merged[0].id).toBe('seed-Seeded Far');
    expect(merged.at(-1)?.name).toBe('Place 39');
  });
});

describe('nearby source', () => {
  const body = { elements: [element({ id: 5 })] };
  const ok = () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(body) });
  const setup = (responses: (() => Promise<unknown>)[]) => {
    let clock = 0;
    const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
    const fetcher = (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, init });
      return (responses[calls.length - 1] ?? ok)();
    };
    const source = createNearbySource({ fetcher: fetcher as never, now: () => clock });
    return { source, calls, advance: (ms: number) => { clock += ms; } };
  };

  it('sends one polite request and returns normalised places', async () => {
    const { source, calls } = setup([ok]);
    const places = await source.load(suwanee);
    expect(places.map((place) => place.key)).toEqual(['osm:node/5']);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.headers['User-Agent']).toMatch(/FoodieCards/);
    expect(decodeURIComponent(calls[0].init.body)).toContain('around:5000');
  });

  it('serves the same area from the session cache without another request', async () => {
    const { source, calls } = setup([ok]);
    await source.load(suwanee);
    await source.load({ latitude: suwanee.latitude + 0.00001, longitude: suwanee.longitude });
    expect(calls).toHaveLength(1);
  });

  it('shares one request between callers that ask at the same time', async () => {
    const { source, calls } = setup([ok]);
    await Promise.all([source.load(suwanee), source.load(suwanee)]);
    expect(calls).toHaveLength(1);
  });

  it('fetches again for a different area and after the cache expires', async () => {
    const { source, calls, advance } = setup([ok, ok, ok]);
    await source.load(suwanee);
    await source.load({ latitude: 33.749, longitude: -84.388 });
    advance(31 * 60 * 1000);
    await source.load(suwanee);
    expect(calls).toHaveLength(3);
  });

  it('backs off after a 429 instead of retrying straight away', async () => {
    const limited = () => Promise.resolve({ ok: false, status: 429, headers: { get: () => null }, json: () => Promise.resolve({}) });
    const { source, calls, advance } = setup([limited, ok]);
    await expect(source.load(suwanee)).rejects.toBeInstanceOf(OverpassError);
    await expect(source.load(suwanee)).rejects.toMatchObject({ reason: 'rate-limited' });
    expect(calls).toHaveLength(1);
    advance(61 * 1000);
    await expect(source.load(suwanee)).resolves.toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it('reports a network failure without caching it', async () => {
    const down = () => Promise.reject(new Error('offline'));
    const { source, calls } = setup([down, ok]);
    await expect(source.load(suwanee)).rejects.toMatchObject({ reason: 'failed' });
    await expect(source.load(suwanee)).resolves.toHaveLength(1);
    expect(calls).toHaveLength(2);
  });
});
