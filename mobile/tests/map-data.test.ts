import { describe, expect, it } from 'vitest';
import { ATLANTA_DOWNTOWN, RESTAURANT_COORDINATES, coordinateFor, distanceKm } from '../src/features/map/coordinates';
import { DISCOVERY_RADIUS_METRES, areaLabel, discoveryArea, distanceLabel, inDiscoveryArea, offerSearchHere } from '../src/features/map/discoveryArea';
import { categoryLabel, flavourLine } from '../src/features/map/labels';
import { buildMapRestaurants, discoveredCount } from '../src/features/map/mapRestaurants';
import { hudProgress } from '../src/features/map/hud';
import { pinLook } from '../src/features/map/pinStyle';
import { animatedPinIds, idleMotion, inRegion } from '../src/features/map/pinMotion';
import { circleRing } from '../src/features/map/fog';
import type { CardView } from '../src/features/cards/types';

const theme = { primaryColor: '#9E1B32', accentColor: '#F2C94C', fontKey: 'bold', patternKey: 'dots' } as CardView['restaurant']['theme'];
const place = (id: string, name: string, category = 'pizza'): CardView['restaurant'] => ({
  id, name, locationLabel: 'Downtown · 61 North Ave NW', category, theme, heroImagePath: null, heroImageKind: null,
});
const VARSITY = '10000000-0000-4000-8000-000000000004';
const ANTICO = '10000000-0000-4000-8000-000000000005';
const card = (restaurant: CardView['restaurant'], stage: CardView['stage']): CardView => ({
  id: `card-${restaurant.id}`, stage, cardXP: 0, visitCount: 1, lastVisitDate: null, rating: null, restaurant,
});

describe('restaurant coordinates', () => {
  it('has a coordinate inside Atlanta for each of the five seeded restaurants', () => {
    const ids = [1, 2, 3, 4, 5].map((n) => `10000000-0000-4000-8000-00000000000${n}`);
    for (const id of ids) {
      const coordinate = RESTAURANT_COORDINATES[id];
      expect(coordinate).toBeDefined();
      expect(distanceKm(coordinate, ATLANTA_DOWNTOWN)).toBeLessThan(8);
    }
  });

  it('prefers coordinates stored on the restaurant over the lookup table', () => {
    expect(coordinateFor({ id: VARSITY, latitude: 33.7, longitude: -84.3 })).toEqual({ latitude: 33.7, longitude: -84.3 });
    expect(coordinateFor({ id: VARSITY })).toEqual(RESTAURANT_COORDINATES[VARSITY]);
  });

  it('has no coordinate for an unknown restaurant or an invalid stored one', () => {
    expect(coordinateFor({ id: 'unknown' })).toBeNull();
    expect(coordinateFor({ id: 'unknown', latitude: 120, longitude: -84 })).toBeNull();
    expect(coordinateFor({ id: 'unknown', latitude: null, longitude: null })).toBeNull();
  });
});

describe('discovery area', () => {
  const midtown = { latitude: 33.781, longitude: -84.383 };
  const newYork = { latitude: 40.71, longitude: -74.0 };

  it('is a fixed 5 km circle around the player, wherever they are', () => {
    expect(DISCOVERY_RADIUS_METRES).toBe(5000);
    expect(discoveryArea(midtown)).toEqual({ centre: midtown, fallback: false });
    expect(discoveryArea(newYork)).toEqual({ centre: newYork, fallback: false });
  });

  it('falls back to downtown Atlanta, flagged as a fallback, without a location', () => {
    expect(discoveryArea(null)).toEqual({ centre: ATLANTA_DOWNTOWN, fallback: true });
  });

  it('keeps all five seeded restaurants inside the downtown fallback area', () => {
    for (const coordinate of Object.values(RESTAURANT_COORDINATES)) expect(inDiscoveryArea(coordinate, discoveryArea(null))).toBe(true);
  });

  it('uses real distance: just inside is in, just outside is out', () => {
    const area = discoveryArea(midtown);
    expect(inDiscoveryArea({ latitude: midtown.latitude + 0.0440, longitude: midtown.longitude }, area)).toBe(true);
    expect(inDiscoveryArea({ latitude: midtown.latitude + 0.0460, longitude: midtown.longitude }, area)).toBe(false);
    expect(inDiscoveryArea(RESTAURANT_COORDINATES['10000000-0000-4000-8000-000000000004'], discoveryArea(newYork))).toBe(false);
  });

  it('labels distance in miles, or feet when very close', () => {
    expect(distanceLabel(midtown, { latitude: midtown.latitude + 0.0116, longitude: midtown.longitude })).toBe('0.8 mi');
    expect(distanceLabel(midtown, { latitude: midtown.latitude + 0.0005, longitude: midtown.longitude })).toBe('180 ft');
  });

  it('shows no distance without a real player position', () => {
    expect(distanceLabel(null, midtown)).toBeNull();
  });

  it('names the area honestly', () => {
    expect(areaLabel(discoveryArea(midtown), 'Atlanta, GA')).toBe('Atlanta, GA');
    expect(areaLabel(discoveryArea(midtown), null)).toBe('Your area');
    expect(areaLabel(discoveryArea(null), 'Atlanta, GA')).toBe('Downtown Atlanta · location off');
  });
});

describe('panel wording', () => {
  it('turns a category key into a readable label', () => {
    expect(categoryLabel('soul_food')).toBe('Soul food');
    expect(categoryLabel('pizza')).toBe('Pizza');
    expect(categoryLabel('  ')).toBe('Restaurant');
  });

  it('has a flavour line per cuisine and a general one otherwise', () => {
    expect(flavourLine('barbecue')).toBe('Low, slow and smoky.');
    expect(flavourLine('food_truck')).toBe('A table worth coming back to.');
  });
});

describe('buildMapRestaurants', () => {
  const varsity = place(VARSITY, 'The Varsity', 'fast_food');
  const antico = place(ANTICO, 'Antico Pizza');

  it('marks owned restaurants as collected with their stage and leaves the rest locked', () => {
    const pins = buildMapRestaurants({ owned: [card(varsity, 'regular')], locked: [antico] });
    expect(pins.map((pin) => [pin.name, pin.card?.stage ?? null])).toEqual([['Antico Pizza', null], ['The Varsity', 'regular']]);
    expect(pins[1].card?.id).toBe(`card-${VARSITY}`);
    expect(discoveredCount(pins)).toBe(1);
  });

  it('splits the location label into neighbourhood and address and picks the icon', () => {
    const [pin] = buildMapRestaurants({ owned: [], locked: [varsity] });
    expect(pin).toMatchObject({ neighbourhood: 'Downtown', address: '61 North Ave NW', icon: 'plate', cuisine: 'default', category: 'fast_food', theme });
  });

  it('leaves out restaurants without coordinates', () => {
    expect(buildMapRestaurants({ owned: [], locked: [place('no-coordinates', 'Mystery')] })).toEqual([]);
  });
});

describe('pin look', () => {
  it('uses silver, gold and purple-gold for the three stages', () => {
    expect(pinLook('discovered').glow).toBe('#c9d1dc');
    expect(pinLook('regular').glow).toBe('#f2b632');
    expect(pinLook('house_favorite')).toMatchObject({ glow: '#a45cff', sparkle: true });
  });

  it('dims a locked pin and gives it no glow', () => {
    expect(pinLook(null)).toMatchObject({ glow: null, locked: true, sparkle: false });
    expect(pinLook(null).opacity).toBe(0.55);
  });
});

describe('pin motion', () => {
  it('gives each cuisine its own idle motion', () => {
    expect(idleMotion('pizza')).toBe('spin');
    expect(idleMotion('coffee')).toBe('steam');
    expect(idleMotion('bbq')).toBe('flicker');
    expect(idleMotion('burger')).toBe('bounce');
    expect(idleMotion('sushi')).toBe('bob');
    expect(idleMotion('southern')).toBe('pulse');
    expect(idleMotion('plate')).toBe('float');
  });

  const region = { latitude: 33.77, longitude: -84.39, latitudeDelta: 0.04, longitudeDelta: 0.04 };
  const pin = (id: string, latitude: number, collected = true) => ({ id, coordinate: { latitude, longitude: -84.39 }, card: collected ? { id: `c-${id}`, stage: 'discovered' as const } : null });

  it('knows whether a coordinate is on screen', () => {
    expect(inRegion({ latitude: 33.78, longitude: -84.39 }, region)).toBe(true);
    expect(inRegion({ latitude: 33.80, longitude: -84.39 }, region)).toBe(false);
  });

  it('animates only collected pins that are on screen', () => {
    const ids = animatedPinIds([pin('on', 33.77), pin('off', 33.9), pin('locked', 33.77, false)], region, 8);
    expect([...ids]).toEqual(['on']);
  });

  it('caps the number of animated pins, keeping those nearest the centre', () => {
    const pins = [pin('far', 33.785), pin('near', 33.771), pin('mid', 33.778)];
    expect([...animatedPinIds(pins, region, 2)]).toEqual(['near', 'mid']);
  });

  it('animates nothing before the map has reported a region', () => {
    expect(animatedPinIds([pin('on', 33.77)], null, 8).size).toBe(0);
  });
});

describe('hud', () => {
  it('shows progress through the current level of 200 XP', () => {
    expect(hudProgress({ accountXP: 350, accountLevel: 2 }, 2, 5)).toEqual({ level: 2, xpIntoLevel: 150, xpPerLevel: 200, fraction: 0.75, xpLabel: 'Lv 2 · 350 XP · 150/200 to Lv 3', discoveredLabel: '2 / 5 discovered' });
  });

  it('starts empty for a new account', () => {
    expect(hudProgress({ accountXP: 0, accountLevel: 1 }, 0, 5)).toMatchObject({ level: 1, fraction: 0, xpLabel: 'Lv 1 · 0 XP · 0/200 to Lv 2', discoveredLabel: '0 / 5 discovered' });
  });
});

describe('fog', () => {
  it('draws a closed ring of points at the given radius', () => {
    const centre = { latitude: 33.77, longitude: -84.39 };
    const ring = circleRing(centre, 400, 24);
    expect(ring).toHaveLength(24);
    for (const point of ring) expect(distanceKm(point, centre) * 1000).toBeCloseTo(400, -1);
  });
});

describe('search this area', () => {
  const midtown = { latitude: 33.781, longitude: -84.383 };
  const area = discoveryArea(midtown);

  it('is offered only once the map centre is more than 1 km from the circle centre', () => {
    expect(offerSearchHere(midtown, area)).toBe(false);
    expect(offerSearchHere({ latitude: midtown.latitude + 0.0085, longitude: midtown.longitude }, area)).toBe(false);
    expect(offerSearchHere({ latitude: midtown.latitude + 0.0095, longitude: midtown.longitude }, area)).toBe(true);
  });
});
