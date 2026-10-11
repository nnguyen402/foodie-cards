import { describe, expect, it, vi } from 'vitest';
import type { OsmPlace } from '../src/features/map/osm';
import { appendCandidates, candidateDistance, initialPlacePick, nearbyForReceipt, searchBias, searchCandidates } from '../src/features/receipts/place-picker';

const user = { latitude: 33.75, longitude: -84.39 };
const at = (dLat: number) => ({ latitude: 33.75 + dLat, longitude: -84.39 });
const osm = (id: number, name: string, dLat: number): OsmPlace => ({ osmType: 'node', osmId: id, key: `osm:node/${id}`, name, coordinate: at(dLat), amenity: 'fast_food', cuisine: null, address: null, city: null });
const seeded = [
  { id: 's1', name: 'Antico Pizza', coordinate: at(0.3) },
  { id: 's2', name: 'The Varsity', coordinate: null },
];
const base = { receiptName: 'Chick-fil-A', draftRestaurantId: null, user, nearby: [] as OsmPlace[], seeded, unlock: null };
const unlock = (fields: { restaurantId?: string; osm?: string }) => ({ name: 'Tapped Place', visit: false, ...fields });
const keyOf = (c: { kind: string; restaurantId?: string; place?: OsmPlace } | null) => (c ? (c.kind === 'seeded' ? c.restaurantId : c.place?.key) : null);

describe('initialPlacePick', () => {
  it('preselects a close name match and keeps search closed', () => {
    const pick = initialPlacePick({ ...base, nearby: [osm(1, 'Chick-fil-A', 0.001)] });
    expect(keyOf(pick.chosen)).toBe('osm:node/1');
    expect(pick.searchOpen).toBe(false);
    expect(pick.searchQuery).toBe('Chick-fil-A');
  });

  it('lists nearby places before seeded restaurants, chosen first, no duplicates', () => {
    const pick = initialPlacePick({ ...base, nearby: [osm(1, 'Chick-fil-A', 0.001), osm(2, 'Taco Spot', 0.002)] });
    expect(pick.candidates.map(keyOf)).toEqual(['osm:node/1', 'osm:node/2', 's1', 's2']);
  });

  it('drops nearby places beyond 500 m from matching', () => {
    const pick = initialPlacePick({ ...base, nearby: [osm(1, 'Chick-fil-A', 0.01)] });
    expect(pick.chosen).toBeNull();
    expect(pick.candidates.map(keyOf)).toEqual(['s1', 's2']);
    expect(pick.searchOpen).toBe(true);
  });

  it('prefers the place tapped on the map, even when it is further than the match radius', () => {
    const pick = initialPlacePick({ ...base, nearby: [osm(1, 'Chick-fil-A', 0.001), osm(9, 'Far Diner', 0.02)], unlock: unlock({ osm: 'node/9' }) });
    expect(keyOf(pick.chosen)).toBe('osm:node/9');
    expect(pick.candidates[0]).toBe(pick.chosen);
  });

  it('uses the ranked seeded copy (with coordinate) for an unlocked restaurant', () => {
    const pick = initialPlacePick({ ...base, unlock: unlock({ restaurantId: 's1' }) });
    expect(pick.chosen).toMatchObject({ kind: 'seeded', restaurantId: 's1', coordinate: at(0.3) });
  });

  it('falls back to the matcher when the unlock target does not resolve', () => {
    const pick = initialPlacePick({ ...base, nearby: [osm(1, 'Chick-fil-A', 0.001)], unlock: unlock({ osm: 'node/404' }) });
    expect(keyOf(pick.chosen)).toBe('osm:node/1');
  });

  it("falls back to the server's restaurant when nothing nearby matches", () => {
    const pick = initialPlacePick({ ...base, receiptName: 'Antico', draftRestaurantId: 's1' });
    expect(keyOf(pick.chosen)).toBe('s1');
  });

  it('missing receipt name: no preselect, nearby by distance, search open with an empty box', () => {
    const pick = initialPlacePick({ ...base, receiptName: null, nearby: [osm(1, 'B', 0.002), osm(2, 'A', 0.001)] });
    expect(pick.chosen).toBeNull();
    expect(pick.candidates.slice(0, 2).map((c) => c.name)).toEqual(['A', 'B']);
    expect(pick.searchOpen).toBe(true);
    expect(pick.searchQuery).toBe('');
  });

  it('location denied: never matches OSM places and opens search, even with a seeded name match', () => {
    const pick = initialPlacePick({ ...base, receiptName: 'Antico Pizza', user: null, nearby: [osm(1, 'Antico Pizza', 0)] });
    expect(keyOf(pick.chosen)).toBe('s1');
    expect(pick.candidates.every((c) => c.kind === 'seeded')).toBe(true);
    expect(pick.searchOpen).toBe(true);
  });

  it('seeds the search box with the unlock name when the receipt has none', () => {
    expect(initialPlacePick({ ...base, receiptName: '  ', unlock: unlock({ osm: 'node/404' }) }).searchQuery).toBe('Tapped Place');
  });
});

describe('candidate helpers', () => {
  it('appends search results without duplicating listed places', () => {
    const list = searchCandidates([osm(1, 'A', 0)]);
    const next = appendCandidates(list, searchCandidates([osm(1, 'A', 0), osm(2, 'B', 0)]));
    expect(next.map(keyOf)).toEqual(['osm:node/1', 'osm:node/2']);
    expect(appendCandidates(list, searchCandidates([osm(1, 'A', 0)]))).toBe(list);
  });

  it('labels distance in miles, and gives none without a location or a position', () => {
    const [near] = searchCandidates([osm(1, 'A', 0.0015)]);
    expect(candidateDistance(user, near)).toBe('0.1 mi');
    expect(candidateDistance(null, near)).toBeNull();
    expect(candidateDistance(user, { kind: 'seeded', restaurantId: 's2', name: 'X', brandKey: 'name:x', coordinate: null })).toBeNull();
  });
});

describe('searchBias', () => {
  it('rounds the user position to 0.1 degree before it goes to the search service', () => {
    expect(searchBias({ latitude: 33.74913, longitude: -84.38771 })).toEqual({ latitude: 33.7, longitude: -84.4 });
    expect(searchBias(null)).toBeNull();
  });
});

describe('nearbyForReceipt', () => {
  const centre = user;
  const source = (over: Partial<{ cached: OsmPlace[] | null; restored: { places: OsmPlace[]; fresh: boolean } | null; load: () => Promise<OsmPlace[]> }>) => ({
    cached: vi.fn(() => over.cached ?? null),
    restore: vi.fn(async () => over.restored ?? null),
    load: vi.fn(over.load ?? (async () => [osm(3, 'Fresh', 0)])),
  });
  const never = () => new Promise<void>(() => {});

  it("uses the map's session cache without any request", async () => {
    const s = source({ cached: [osm(1, 'Cached', 0)] });
    expect((await nearbyForReceipt(s, centre, { wait: never })).map((p) => p.name)).toEqual(['Cached']);
    expect(s.load).not.toHaveBeenCalled();
  });

  it('uses a fresh saved result without a request', async () => {
    const s = source({ restored: { places: [osm(2, 'Saved', 0)], fresh: true } });
    expect((await nearbyForReceipt(s, centre, { wait: never })).map((p) => p.name)).toEqual(['Saved']);
    expect(s.load).not.toHaveBeenCalled();
  });

  it('fetches once when nothing fresh is around', async () => {
    const s = source({});
    expect((await nearbyForReceipt(s, centre, { wait: never })).map((p) => p.name)).toEqual(['Fresh']);
    expect(s.load).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stale saved result, or nothing, when the fetch fails', async () => {
    const failing = async () => { throw new Error('busy'); };
    expect((await nearbyForReceipt(source({ restored: { places: [osm(2, 'Stale', 0)], fresh: false }, load: failing }), centre, { wait: never })).map((p) => p.name)).toEqual(['Stale']);
    expect(await nearbyForReceipt(source({ load: failing }), centre, { wait: never })).toEqual([]);
  });

  it('stops waiting for a slow server', async () => {
    const s = source({ restored: { places: [osm(2, 'Stale', 0)], fresh: false }, load: () => new Promise(() => {}) });
    expect((await nearbyForReceipt(s, centre, { wait: async () => {} })).map((p) => p.name)).toEqual(['Stale']);
  });
});
