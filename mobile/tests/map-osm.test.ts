import { describe, expect, it } from 'vitest';
import { normalizeOsm, osmIcon, overpassQuery } from '../src/features/map/osm';
import { brandTotals, mapCardAvailability, normalizedName } from '../src/features/map/mapRestaurants';
import { MAX_VISIBLE_RESTAURANTS, mergeNearby, sameRestaurant } from '../src/features/map/mergeNearby';
import { createNearbySource, OverpassError } from '../src/features/map/nearbySource';
import { discoveryArea } from '../src/features/map/discoveryArea';
import { OFFLINE_SNAPSHOT, offlinePlaces } from '../src/features/map/offlineSnapshot';
import { distanceKm } from '../src/features/map/coordinates';
import type { MapRestaurant } from '../src/features/map/mapRestaurants';

const suwanee = { latitude: 34.0515, longitude: -84.0713 };
const area = discoveryArea(suwanee);
const north = (metres: number) => ({ latitude: suwanee.latitude + metres / 111320, longitude: suwanee.longitude });

const element = (over: Record<string, unknown>) => ({ type: 'node', id: 1, lat: suwanee.latitude, lon: suwanee.longitude, tags: { amenity: 'restaurant', name: 'Test Kitchen' }, ...over });

describe('overpassQuery', () => {
  it('asks for named restaurants, fast food and cafes around the centre', () => {
    const query = overpassQuery(suwanee, 3000);
    expect(query).toContain('nwr["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](around:3000,34.0515,-84.0713)');
    expect(query).toContain('[timeout:25]');
    expect(query).toContain('out tags center 120;');
  });
});

describe('normalizeOsm', () => {
  it('keeps the namespaced id, name, coordinates, cuisine and address of a node', () => {
    const [place] = normalizeOsm({ elements: [element({ id: 42, tags: { amenity: 'restaurant', name: 'Pho Corner', cuisine: 'vietnamese;noodle', 'addr:housenumber': '310', 'addr:street': 'Main St', 'addr:city': 'Suwanee' } })] });
    expect(place).toEqual({ osmType: 'node', osmId: 42, key: 'osm:node/42', name: 'Pho Corner', coordinate: suwanee, amenity: 'restaurant', cuisine: 'vietnamese', address: '310 Main St', city: 'Suwanee', brand: null, brandWikidata: null });
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
    expect(osmIcon('vietnamese', 'restaurant')).toBe('sushi');
    expect(osmIcon('klingon', 'restaurant')).toBe('plate');
    expect(osmIcon(null, 'restaurant')).toBe('plate');
  });
});

const osmPlace = (id: number, name: string, metresNorth: number) => normalizeOsm({ elements: [element({ id, lat: north(metresNorth).latitude, tags: { amenity: 'restaurant', name } })] })[0];
const seeded = (name: string, metresNorth: number): MapRestaurant => ({
  id: `seed-${name}`, source: 'catalog', osm: null, name, brandKey: `name:${normalizedName(name)}`, neighbourhood: 'Town', address: '1 Main St', category: 'pizza', cuisine: 'pizza', icon: 'pizza',
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
  it('keeps only places inside the 3 km circle, by real distance', () => {
    const merged = mergeNearby([], [osmPlace(1, 'Near', 2900), osmPlace(2, 'Far', 3200)], area);
    expect(merged.map((pin) => pin.name)).toEqual(['Near']);
  });

  it('always keeps our own restaurants, even far outside the 3 km circle; OSM places keep the limit', () => {
    const merged = mergeNearby([seeded('Far Seeded', 4400)], [osmPlace(1, 'Near', 500), osmPlace(2, 'Too Far', 3500)], area);
    expect(merged.map((pin) => pin.name)).toEqual(['Far Seeded', 'Near']);
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

  it('marks an unsupported OSM place unavailable while a catalog place can still be scanned', () => {
    const [nearby] = mergeNearby([], [osmPlace(1, 'Nearby Only', 300)], area);
    const [catalog] = mergeNearby([seeded('Supported Place', 300)], [], area);
    expect(mapCardAvailability(nearby)).toBe('unavailable');
    expect(mapCardAvailability(catalog)).toBe('scan');
  });

  it('caps the visible set at 40, seeded first, then the nearest OSM places', () => {
    const many = Array.from({ length: 60 }, (_, index) => osmPlace(index + 1, `Place ${index + 1}`, 100 + index * 50));
    const merged = mergeNearby([seeded('Seeded Far', 2900)], many, area);
    expect(MAX_VISIBLE_RESTAURANTS).toBe(40);
    expect(merged).toHaveLength(40);
    expect(merged[0].id).toBe('seed-Seeded Far');
    expect(merged.at(-1)?.name).toBe('Place 39');
  });
});

describe('nearby source', () => {
  const body = { elements: [element({ id: 5 })] };
  const reply = (status: number) => () => Promise.resolve({ ok: status === 200, status, headers: { get: () => null }, json: () => Promise.resolve(body) });
  const ok = reply(200);
  const down = () => Promise.reject(new Error('offline'));
  const setup = (responses: (() => Promise<unknown>)[], saved: Record<string, string> = {}) => {
    let clock = 0;
    const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
    const logs: string[] = [];
    const fetcher = (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, init });
      return (responses[calls.length - 1] ?? ok)();
    };
    const storage = { getItem: async (key: string) => saved[key] ?? null, setItem: async (key: string, value: string) => { saved[key] = value; } };
    const make = () => createNearbySource({ fetcher: fetcher as never, now: () => clock, storage, sleep: async () => {}, log: (message) => logs.push(message) });
    return { source: make(), make, calls, logs, saved, advance: (ms: number) => { clock += ms; } };
  };
  const hosts = (calls: { url: string }[]) => calls.map((call) => call.url.split('/')[2]);

  it('sends one polite request and returns normalised places', async () => {
    const { source, calls } = setup([ok]);
    const places = await source.load(suwanee);
    expect(places.map((place) => place.key)).toEqual(['osm:node/5']);
    expect(hosts(calls)).toEqual(['overpass-api.de']);
    expect(calls[0].init.headers['User-Agent']).toMatch(/FoodieCards/);
    expect(decodeURIComponent(calls[0].init.body)).toContain('around:3000');
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

  it('moves on to the next mirror when one is rate limited or down, and logs why', async () => {
    const { source, calls, logs } = setup([reply(429), down, ok]);
    await expect(source.load(suwanee)).resolves.toHaveLength(1);
    expect(hosts(calls)).toEqual(['overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee']);
    expect(logs).toEqual(['[nearby] overpass-api.de failed: HTTP 429', '[nearby] overpass.kumi.systems failed: offline']);
  });

  it('rests a rate-limited endpoint for a minute and goes straight to the next one', async () => {
    const { source, calls, advance } = setup([reply(429), ok, ok, ok]);
    await source.load(suwanee);
    advance(30 * 1000);
    await source.load({ latitude: 33.749, longitude: -84.388 });
    expect(hosts(calls)).toEqual(['overpass-api.de', 'overpass.kumi.systems', 'overpass.kumi.systems']);
    advance(61 * 1000);
    await source.load({ latitude: 40.71, longitude: -74.0 });
    expect(hosts(calls).at(-1)).toBe('overpass-api.de');
  });

  it('fails with the last reason when every mirror fails, and does not cache the failure', async () => {
    const { source, calls, logs } = setup([reply(500), down, reply(500), ok]);
    await expect(source.load(suwanee)).rejects.toBeInstanceOf(OverpassError);
    expect(logs).toHaveLength(3);
    expect(logs[0]).toContain('HTTP 500');
    await expect(source.load(suwanee)).resolves.toHaveLength(1);
    expect(calls).toHaveLength(4);
  });

  it('does not ask at all while every endpoint is resting', async () => {
    const { source, calls, logs } = setup([reply(429), reply(429), reply(429)]);
    await expect(source.load(suwanee)).rejects.toMatchObject({ reason: 'rate-limited' });
    await expect(source.load(suwanee)).rejects.toMatchObject({ reason: 'rate-limited' });
    expect(calls).toHaveLength(3);
    expect(logs.at(-1)).toContain('resting');
  });

  it('saves the last good result and restores it after a reload without a request', async () => {
    const { source, make, calls } = setup([ok]);
    await source.load(suwanee);
    await Promise.resolve();
    const reloaded = make();
    const restored = await reloaded.restore(suwanee);
    expect(restored).toMatchObject({ fresh: true });
    expect(restored?.places.map((place) => place.key)).toEqual(['osm:node/5']);
    await reloaded.load(suwanee);
    expect(calls).toHaveLength(1);
  });

  it('still offers a saved result that is old or from a little way off, but marks it stale', async () => {
    const { source, make, advance } = setup([ok]);
    await source.load(suwanee);
    await Promise.resolve();
    expect(await make().restore(north(800))).toMatchObject({ fresh: false });
    advance(2 * 60 * 60 * 1000);
    expect(await make().restore(suwanee)).toMatchObject({ fresh: false });
  });

  it('ignores a saved result from somewhere else, or one that cannot be read', async () => {
    const { source, make, saved } = setup([ok]);
    await source.load(suwanee);
    await Promise.resolve();
    expect(await make().restore({ latitude: 33.749, longitude: -84.388 })).toBeNull();
    for (const key of Object.keys(saved)) saved[key] = '{broken';
    expect(await make().restore(suwanee)).toBeNull();
  });
});

describe('504 handling', () => {
  const body = { elements: [element({ id: 5 })] };
  const reply = (status: number) => () => Promise.resolve({ ok: status === 200, status, headers: { get: () => null }, json: () => Promise.resolve(body) });
  const run = async (responses: (() => Promise<unknown>)[]) => {
    const calls: { url: string; body: string }[] = [];
    const fetcher = (url: string, init: { body: string }) => {
      calls.push({ url, body: decodeURIComponent(init.body) });
      return (responses[calls.length - 1] ?? reply(200))();
    };
    const source = createNearbySource({ fetcher: fetcher as never, now: () => 0, sleep: async () => {} });
    const result = await source.load(suwanee).then((places) => places.length, () => 'failed');
    return { calls, result };
  };

  it('retries the same endpoint once with a 2 km radius', async () => {
    const { calls, result } = await run([reply(504), reply(200)]);
    expect(result).toBe(1);
    expect(calls.map((call) => call.url.split('/')[2])).toEqual(['overpass-api.de', 'overpass-api.de']);
    expect(calls[0].body).toContain('around:3000');
    expect(calls[1].body).toContain('around:2000');
  });

  it('moves to the next mirror when the smaller circle also times out', async () => {
    const { calls, result } = await run([reply(504), reply(504), reply(200)]);
    expect(result).toBe(1);
    expect(calls.map((call) => call.url.split('/')[2])).toEqual(['overpass-api.de', 'overpass-api.de', 'overpass.kumi.systems']);
    expect(calls[2].body).toContain('around:3000');
  });
});

describe('offline snapshot', () => {
  it('holds real, complete OpenStreetMap places around GSU', () => {
    expect(OFFLINE_SNAPSHOT.label).toBe('offline snapshot');
    expect(OFFLINE_SNAPSHOT.places.length).toBeGreaterThanOrEqual(40);
    const keys = OFFLINE_SNAPSHOT.places.map((place) => place.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const place of OFFLINE_SNAPSHOT.places) {
      expect(place.key).toBe(`osm:${place.osmType}/${place.osmId}`);
      expect(place.name.trim()).not.toBe('');
      expect(distanceKm(place.coordinate, OFFLINE_SNAPSHOT.centre) * 1000).toBeLessThanOrEqual(OFFLINE_SNAPSHOT.coverageMetres + 1);
    }
  });

  it('fills the map around GSU and offers nothing where it does not reach', () => {
    expect(mergeNearby([], offlinePlaces(OFFLINE_SNAPSHOT.centre), discoveryArea(OFFLINE_SNAPSHOT.centre))).toHaveLength(40);
    expect(offlinePlaces(suwanee)).toEqual([]);
  });
});

describe('chains', () => {
  const branch = (id: number, tags: Record<string, string>, metresNorth: number) =>
    normalizeOsm({ elements: [element({ id, lat: north(metresNorth).latitude, tags: { amenity: 'fast_food', ...tags } })] })[0];
  const cfaCard = { id: 'card-cfa', stage: 'regular' } as MapRestaurant['card'];
  const owned = { ...seeded("Chick-fil-A", 2900), card: cfaCard };

  it('reads brand and brand:wikidata from the tags', () => {
    expect(branch(1, { name: 'Chick-fil-A #12', brand: 'Chick-fil-A', 'brand:wikidata': 'Q491516' }, 100)).toMatchObject({ brand: 'Chick-fil-A', brandWikidata: 'Q491516' });
  });

  it('gives every location of an owned brand the same card, grouped by wikidata or by name', () => {
    const merged = mergeNearby([owned], [
      branch(1, { name: 'Chick-fil-A', brand: 'Chick-fil-A', 'brand:wikidata': 'Q491516' }, 300),
      branch(2, { name: 'Chick Fil A Midtown', brand: 'Chick-fil-A' }, 600),
      branch(3, { name: "Chick-fil-A" }, 900),
      branch(4, { name: 'Wendys', brand: "Wendy's" }, 1200),
    ], area);
    const osm = merged.filter((pin) => pin.source === 'osm');
    expect(osm.slice(0, 3).every((pin) => pin.card === cfaCard)).toBe(true);
    expect(mapCardAvailability(osm[0])).toBe('view');
    expect(osm[3].card).toBeNull();
    expect(osm.map((pin) => pin.brandKey)).toEqual(['name:chick fil a', 'name:chick fil a', 'name:chick fil a', 'name:wendy s']);
    expect(brandTotals(merged)).toEqual({ discovered: 1, total: 2 });
  });

  it('counts the locations of one brand as one restaurant', () => {
    const merged = mergeNearby([owned], [branch(1, { name: 'Chick-fil-A' }, 300), branch(2, { name: 'Chick-fil-A' }, 700), branch(3, { name: "McDonald's" }, 800)], area);
    expect(brandTotals(merged)).toEqual({ discovered: 1, total: 2 });
  });
});
