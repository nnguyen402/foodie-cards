import { describe, expect, it, vi } from 'vitest';
import { createPlaceSearch, mapNominatim, nominatimUrl } from '../src/features/receipts/place-search';

describe('nominatim place search', () => {
  it('builds a jsonv2 URL biased to the user area', () => {
    const url = new URL(nominatimUrl('Chick-fil-A', { latitude: 33.75, longitude: -84.39 }));
    expect(url.host).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('q')).toBe('Chick-fil-A');
    expect(url.searchParams.get('viewbox')).toBeTruthy();
  });
  it('omits the viewbox without a location', () => {
    expect(new URL(nominatimUrl('Chick-fil-A', null)).searchParams.has('viewbox')).toBe(false);
  });
  it('maps results to OsmPlace and drops rows without coordinates or osm ids', () => {
    const places = mapNominatim([
      { osm_type: 'node', osm_id: 7, name: 'Chick-fil-A', display_name: 'Chick-fil-A, 1 Main St, Atlanta', lat: '33.7', lon: '-84.4', category: 'amenity', type: 'fast_food' },
      { osm_type: 'node', osm_id: 8, name: 'Bad', lat: 'x', lon: '1' },
      { name: 'No id', lat: '1', lon: '1' },
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ osmType: 'node', osmId: 7, key: 'osm:node/7', amenity: 'fast_food', cuisine: null, brand: null, brandWikidata: null, coordinate: { latitude: 33.7, longitude: -84.4 } });
  });
  it('returns [] for non-array responses', () => {
    expect(mapNominatim({})).toEqual([]);
    expect(mapNominatim(null)).toEqual([]);
    expect(mapNominatim('x')).toEqual([]);
  });
  it('tolerates odd rows: nulls, bad types, missing names, non-amenity categories', () => {
    const places = mapNominatim([
      null, 42, 'x', [],
      { osm_type: 'point', osm_id: 1, name: 'Bad type', lat: '1', lon: '1' },
      { osm_type: 'node', osm_id: '9', name: 'String id', lat: '1', lon: '1' },
      { osm_type: 'node', osm_id: 10, lat: '1', lon: '1' },
      { osm_type: 'node', osm_id: 11, name: 'No lon', lat: '1' },
      { osm_type: 'way', osm_id: 12, display_name: 'Shop Name, 5 Elm St, Town', lat: '10', lon: '20', category: 'shop', type: 'bakery', address: { house_number: '5', road: 'Elm St' } },
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ osmType: 'way', osmId: 12, name: 'Shop Name', amenity: 'restaurant', address: '5 Elm St' });
  });
  it('rejects out-of-range coordinates', () => {
    expect(mapNominatim([{ osm_type: 'node', osm_id: 1, name: 'A', lat: '95', lon: '0' }, { osm_type: 'node', osm_id: 2, name: 'B', lat: '0', lon: '181' }])).toEqual([]);
  });
  it('caches by normalised query and spaces requests one second apart', async () => {
    const fetcher = vi.fn(async () => new Response('[]'));
    let t = 0; const waits: number[] = [];
    const search = createPlaceSearch(fetcher as never, () => t, async (ms) => { waits.push(ms); t += ms; });
    await search('Chick-fil-A', null); await search(' chick-fil-a ', null); await search('Other', null);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([1000]);
  });
  it('sends an identifying User-Agent and the abort signal', async () => {
    const fetcher = vi.fn(async (..._args: unknown[]) => new Response('[]'));
    const signal = new AbortController().signal;
    await createPlaceSearch(fetcher as never, () => 0, async () => {})('x', null, signal);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('FoodieCards');
    expect(init.signal).toBe(signal);
  });
  it('throws a friendly error on a non-OK response and does not cache it', async () => {
    const fetcher = vi.fn(async () => new Response('no', { status: 429 }));
    const search = createPlaceSearch(fetcher as never, () => 0, async () => {});
    await expect(search('x', null)).rejects.toThrow('Place search is unavailable right now.');
    await expect(search('x', null)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('maps an empty or garbage body to no places', async () => {
    const search = createPlaceSearch((async () => new Response('[]')) as never, () => 0, async () => {});
    expect(await search('nothing', null)).toEqual([]);
    const odd = createPlaceSearch((async () => new Response('{"error":"x"}')) as never, () => 0, async () => {});
    expect(await odd('nothing', null)).toEqual([]);
  });
});
