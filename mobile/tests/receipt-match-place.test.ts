import { describe, expect, it } from 'vitest';
import { matchReceiptToPlace, brandKeyFor } from '../src/features/receipts/match-place';

const user = { latitude: 33.75, longitude: -84.39 };
const at = (dLat: number) => ({ latitude: 33.75 + dLat, longitude: -84.39 });
const osm = (id: number, name: string, dLat: number, extra = {}) => ({ osmType: 'node' as const, osmId: id, key: `osm:node/${id}`, name, coordinate: at(dLat), amenity: 'fast_food', cuisine: null, address: null, city: null, ...extra });

describe('matchReceiptToPlace', () => {
  it('preselects a close place with the same name', () => {
    const r = matchReceiptToPlace({ receiptName: 'Chick-fil-A', user, nearby: [osm(1, 'Chick-fil-A', 0.001)], seeded: [] });
    expect(r.preselected?.candidate.kind).toBe('osm');
  });
  it('ignores store numbers and punctuation', () => {
    const r = matchReceiptToPlace({ receiptName: 'CHICK-FIL-A #01234', user, nearby: [osm(1, 'Chick-fil-A', 0.001)], seeded: [] });
    expect(r.preselected).not.toBeNull();
  });
  it('matches McDonald\'s and Mcdonalds', () => {
    expect(matchReceiptToPlace({ receiptName: 'Mcdonalds', user, nearby: [osm(1, "McDonald's", 0.001)], seeded: [] }).preselected).not.toBeNull();
  });
  it('picks the nearest of several same-brand branches and keeps the rest listed', () => {
    const r = matchReceiptToPlace({ receiptName: 'Chick-fil-A', user, nearby: [osm(1, 'Chick-fil-A', 0.002), osm(2, 'Chick-fil-A', 0.001)], seeded: [] });
    expect(r.preselected?.candidate).toMatchObject({ place: { osmId: 2 } });
    expect(r.candidates).toHaveLength(2);
  });
  it('does not preselect beyond 300 m', () => {
    const r = matchReceiptToPlace({ receiptName: 'Chick-fil-A', user, nearby: [osm(1, 'Chick-fil-A', 0.01)], seeded: [] });
    expect(r.preselected).toBeNull();
    expect(r.candidates).toHaveLength(1);
  });
  it('without a location never preselects an OSM place but can preselect a seeded name match', () => {
    const seeded = [{ id: 's1', name: 'Antico Pizza', coordinate: null }];
    expect(matchReceiptToPlace({ receiptName: 'Chick-fil-A', user: null, nearby: [osm(1, 'Chick-fil-A', 0)], seeded }).preselected).toBeNull();
    expect(matchReceiptToPlace({ receiptName: 'Antico Pizza', user: null, nearby: [], seeded }).preselected?.candidate.kind).toBe('seeded');
  });
  it('missing receipt name lists nearby by distance with no preselect', () => {
    const r = matchReceiptToPlace({ receiptName: null, user, nearby: [osm(1, 'B', 0.002), osm(2, 'A', 0.001)], seeded: [] });
    expect(r.preselected).toBeNull();
    expect(r.candidates.map((c) => c.candidate.name)).toEqual(['A', 'B']);
  });
  it('word containment scores 0.8', () => {
    const r = matchReceiptToPlace({ receiptName: 'Antico Pizza Napoletana', user, nearby: [osm(1, 'Antico Pizza', 0.001)], seeded: [] });
    expect(r.candidates[0].nameScore).toBe(0.8);
  });
  it('brand keys use wikidata, else the normalised brand or name', () => {
    expect(brandKeyFor({ name: 'X', brand: null, brandWikidata: 'Q491516' })).toBe('wikidata:Q491516');
    expect(brandKeyFor({ name: "McDonald's", brand: null, brandWikidata: null })).toBe('name:mcdonald s');
  });
});
