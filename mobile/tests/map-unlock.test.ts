import { describe, expect, it } from 'vitest';
import type { MapRestaurant } from '../src/features/map/mapRestaurants';
import { paramsForTarget, parseUnlockParams, unlockParams } from '../src/features/map/unlockTarget';

const theme = { primaryColor: '#000000', accentColor: '#ffffff', fontKey: 'bold', patternKey: 'none' } as MapRestaurant['theme'];
const base = { brandKey: 'name:x', cuisine: 'default', icon: 'plate', category: 'x', theme, coordinate: { latitude: 1, longitude: 2 }, neighbourhood: 'Midtown', address: '1 Main St' } as const;
const seeded = { ...base, id: 'rest-1', source: 'catalog', osm: null, name: 'Antico Pizza', card: null } as MapRestaurant;
const nearby = { ...base, id: 'osm:node/42', source: 'osm', osm: { type: 'node', id: 42 }, name: 'Corner Cafe', card: null } as MapRestaurant;

describe('unlock params', () => {
  it('identifies a seeded restaurant by its id', () => {
    expect(unlockParams(seeded)).toEqual({ unlockName: 'Antico Pizza', unlockAddress: '1 Main St, Midtown', unlockId: 'rest-1' });
  });

  it('identifies a nearby-only place by name, address and OSM id, with no restaurant id', () => {
    const params = unlockParams(nearby);
    expect(params).toEqual({ unlockName: 'Corner Cafe', unlockAddress: '1 Main St, Midtown', unlockOsm: 'node/42' });
    expect(params).not.toHaveProperty('unlockId');
  });

  it('marks a collected restaurant as another visit', () => {
    expect(unlockParams({ ...seeded, card: { id: 'c' } as MapRestaurant['card'] }).unlockVisit).toBe('1');
  });

  it('round-trips through the Scan screen parser', () => {
    expect(parseUnlockParams(unlockParams(seeded))).toEqual({ name: 'Antico Pizza', restaurantId: 'rest-1', address: '1 Main St, Midtown', osm: undefined, visit: false });
    expect(parseUnlockParams(unlockParams(nearby))).toMatchObject({ name: 'Corner Cafe', restaurantId: undefined, osm: 'node/42' });
  });

  it('Scan forwards exactly the params it was given on to the confirm screen', () => {
    for (const restaurant of [seeded, nearby, { ...seeded, card: { id: 'c' } as MapRestaurant['card'] }]) {
      const params = unlockParams(restaurant);
      expect(paramsForTarget(parseUnlockParams(params)!)).toEqual(params);
    }
  });

  it('shows nothing when the Scan tab is opened on its own', () => {
    expect(parseUnlockParams({})).toBeNull();
    expect(parseUnlockParams({ unlockName: ['Twice', 'x'] })?.name).toBe('Twice');
  });
});
