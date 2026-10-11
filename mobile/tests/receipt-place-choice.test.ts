import { describe, expect, it } from 'vitest';
import { placeSchema } from '../../shared/contracts';
import type { Candidate } from '../src/features/receipts/match-place';
import { submitTargetFor, unlockCandidate } from '../src/features/receipts/place-choice';

const place = (id: number, extra = {}) => ({ osmType: 'node' as const, osmId: id, key: `osm:node/${id}`, name: 'Chick-fil-A', coordinate: { latitude: 33.7, longitude: -84.4 }, amenity: 'fast_food', cuisine: null, address: null, city: null, ...extra });
const osmCandidate = (p: ReturnType<typeof place>): Candidate => ({ kind: 'osm', place: p, name: p.name, brandKey: 'name:chick fil a', coordinate: p.coordinate });

describe('submitTargetFor', () => {
  it('sends only the restaurantId for a seeded candidate', () => {
    expect(submitTargetFor({ kind: 'seeded', restaurantId: 'r1', name: 'X', brandKey: 'name:x', coordinate: null })).toEqual({ restaurantId: 'r1' });
  });
  it('sends the place with its own coordinates and brandKey for an OSM candidate', () => {
    const target = submitTargetFor(osmCandidate(place(42, { brandWikidata: 'Q491516', address: '1 Main St', city: 'Atlanta', cuisine: 'chicken' })));
    expect(target).toEqual({ place: { osmType: 'node', osmId: 42, name: 'Chick-fil-A', address: '1 Main St, Atlanta', brandKey: 'wikidata:Q491516', cuisine: 'chicken', latitude: 33.7, longitude: -84.4 } });
    expect(placeSchema.safeParse((target as { place: unknown }).place).success).toBe(true);
  });
  it('falls back to a name brandKey and omits null optional fields', () => {
    const { place: p } = submitTargetFor(osmCandidate(place(1))) as { place: Record<string, unknown> };
    expect(p.brandKey).toBe('name:chick fil a');
    expect(p).not.toHaveProperty('cuisine');
    expect(p).not.toHaveProperty('address');
  });
  it('uses address alone or city alone when only one is present', () => {
    expect((submitTargetFor(osmCandidate(place(1, { address: '1 Main St' }))) as { place: { address?: string } }).place.address).toBe('1 Main St');
    expect((submitTargetFor(osmCandidate(place(1, { city: 'Atlanta' }))) as { place: { address?: string } }).place.address).toBe('Atlanta');
  });
});

describe('unlockCandidate', () => {
  const seeded = [{ id: 'r1', name: 'Seeded One' }, { id: 'r2', name: 'Seeded Two' }];
  it('finds the seeded row for a restaurantId', () => {
    expect(unlockCandidate({ restaurantId: 'r2' }, [], seeded)).toMatchObject({ kind: 'seeded', restaurantId: 'r2', name: 'Seeded Two' });
  });
  it('finds the nearby place for an osm key', () => {
    expect(unlockCandidate({ osm: 'node/42' }, [place(41), place(42)], seeded)).toMatchObject({ kind: 'osm', place: { osmId: 42 }, name: 'Chick-fil-A' });
  });
  it('prefers the restaurantId when both are given', () => {
    expect(unlockCandidate({ restaurantId: 'r1', osm: 'node/42' }, [place(42)], seeded)?.kind).toBe('seeded');
  });
  it('returns null when nothing resolves', () => {
    expect(unlockCandidate({ restaurantId: 'nope' }, [], seeded)).toBeNull();
    expect(unlockCandidate({ osm: 'node/99' }, [place(42)], seeded)).toBeNull();
    expect(unlockCandidate({ osm: 'garbage' }, [place(42)], seeded)).toBeNull();
    expect(unlockCandidate({}, [place(42)], seeded)).toBeNull();
  });
});
