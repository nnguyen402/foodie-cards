# Place-based restaurant matching, app side: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (This project's owner has ruled out subagents: use superpowers:executing-plans, inline.)

**Goal:** A scanned receipt picks its restaurant from the name on the receipt plus where the user is, and a seeded Chick-fil-A gets the demo working today.

**Architecture:** Pure, unit-tested modules do the work (name scoring and ranking, Nominatim name search, nearby-places loading); one thin hook gathers the phone's location and nearby places; one small component shows the suggestion on the confirm screen. A switch (`PLACE_SUBMIT_SUPPORTED`) keeps non-catalog places from being submitted until Nathan's backend accepts a `place`.

**Tech Stack:** Expo SDK 57 / React Native 0.86, TypeScript, Vitest (node, so tested files must not import React Native), `expo-location`, the existing `nearbySource` (Overpass) and OpenStreetMap Nominatim.

**Spec:** `docs/superpowers/specs/2026-10-11-place-based-restaurants-design.md`

## Scope

This plan covers spec pieces **0 (stopgap SQL), 3 (app) and the Nathan hand-off document (1 and 2 as a proposal)**. It stops where Nathan's work begins: the shared contract, migration and server are his, and **no task here edits `shared/`, `server/` or `supabase/`**. After his backend lands, write a short follow-up plan for "Phase 2" (outlined at the end), because its exact code depends on his final schema.

## Global Constraints

- No subagents. Execute inline with `superpowers:executing-plans`.
- Do not edit `shared/`, `server/`, `supabase/` or any `package.json`. The only SQL written is a stopgap script saved under `docs/`; the agent never runs SQL against Supabase.
- Art is keyed by cuisine only; this plan adds no art and no brand-keyed art.
- The exact user coordinate may be sent to the public Overpass server by the existing nearby map lookup; Nominatim gets a rounded 0.1° area bias. The app backend receives the chosen place's data and coordinates, never the user's coordinate.
- Nominatim policy: at most one request per second, an identifying `User-Agent`, results cached, requests only on a user tap.
- Tested modules (`mobile/src/features/receipts/placeMatch.ts`, `placeSearch.ts`, `nearbyPlaces.ts`) must not import React Native or `@react-native-async-storage/async-storage`.
- Match thresholds (verbatim from the spec): preselect at name score 0.8 or higher within 300 m; list places within 500 m, at most 8.
- Run tests and typecheck from the repo root: `npm test` and `npm run typecheck`. Commit after each task; never push. End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Working branch: `lane-c/art-pins`.

## Review Focus

Inputs and failure modes the spec implies; each has a test in the task that owns the code.

1. Receipt name with a store number and capitals ("CHICK-FIL-A #01234") must match "Chick-fil-A" (Task 2).
2. Location off or unavailable: nothing is preselected, and the list is by name only (Task 2; hook status in Task 4).
3. Two branches in range: the nearest within 300 m is preselected; a branch farther than 300 m is only listed (Task 2).
4. Nominatim returns streets, towns or results with bad coordinates: they are dropped (Task 3).
5. Double taps and rate limits on search: one request per query, a gap of at least 1.1 s, and a clear error on HTTP 429 (Task 3).
6. Overpass fails but a saved copy exists: the saved places are used instead of failing (Task 4).

## File Structure

| File | Responsibility |
|------|----------------|
| `docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql` (create) | Stopgap seed: Chick-fil-A restaurant and starter menu. Run by the user in Supabase. |
| `mobile/src/features/map/coordinates.ts` (modify) | Map coordinates for the seeded Chick-fil-A (id `...0006`). |
| `mobile/src/features/map/mergeNearby.ts` (modify) | Export `brandKeyOf` so matching reuses the map's brand key. |
| `mobile/src/features/receipts/placeMatch.ts` (create) | `PlaceCandidate`, `candidateFromOsm`, `nameScore`, `matchReceiptToPlace`, `catalogRestaurantFor`. Pure. |
| `mobile/src/features/receipts/placeSearch.ts` (create) | Nominatim name search with caching and rate limit. Pure (fetcher injected). |
| `mobile/src/features/map/nearbyPlaces.ts` (create) | `nearbyPlacesFor(source, centre)`: cache, then saved copy, then network. Pure. |
| `mobile/src/features/map/nearbyClient.ts` (create) | The one shared `nearbySource` instance. |
| `mobile/src/features/map/useMapRestaurants.ts` (modify) | Import `nearbySource` from `nearbyClient.ts`. |
| `mobile/src/features/receipts/usePlaceMatch.ts` (create) | Hook: location, nearby places, then a `PlaceMatch`. |
| `mobile/src/features/receipts/placeSupport.ts` (create) | `PLACE_SUBMIT_SUPPORTED` switch. |
| `mobile/src/features/receipts/placeSearchClient.ts` (create) | The shared `placeSearch` instance wired to `fetch`. |
| `mobile/src/features/receipts/PlacePicker.tsx` (create) | The "We think you ate at..." UI. |
| `mobile/app/receipt/confirm.tsx` (modify) | Mount the picker; preselect a catalog restaurant. Nathan is also editing this screen: keep the edit small. |
| `docs/superpowers/handoff/2026-10-11-place-based-submit-for-nathan.md` (create) | Proposed contract, migration, function and server branch, for Nathan. |

---

### Task 1: Chick-fil-A stopgap (SQL and map coordinate)

**Files:**
- Create: `docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql`
- Modify: `mobile/src/features/map/coordinates.ts`
- Test: `mobile/tests/map-data.test.ts`

**Interfaces:**
- Produces: restaurant id `10000000-0000-4000-8000-000000000006`, menu ids `20000000-0000-4000-8000-000000000016` to `...000000000026`, and `RESTAURANT_COORDINATES['10000000-0000-4000-8000-000000000006']`.

- [ ] **Step 1: Write the failing test**

In `mobile/tests/map-data.test.ts`, inside `describe('restaurant coordinates', ...)` add:

```ts
  it('places the seeded Chick-fil-A (id ...0006) from its OpenStreetMap node', () => {
    expect(RESTAURANT_COORDINATES['10000000-0000-4000-8000-000000000006']).toEqual({ latitude: 33.760184, longitude: -84.387039 });
  });
```

In the same file, the test `'keeps the three seeded restaurants nearest downtown inside the fallback area; Fox Bros and Antico are further than 3 km'` filters every entry of `RESTAURANT_COORDINATES`; the new entry is inside the area, so change its name and expectation:

```ts
  it('keeps the seeded restaurants nearest downtown inside the fallback area; Fox Bros and Antico are further than 3 km', () => {
    const inside = Object.entries(RESTAURANT_COORDINATES).filter(([, coordinate]) => inDiscoveryArea(coordinate, discoveryArea(null)));
    expect(inside.map(([id]) => id.slice(-1)).sort()).toEqual(['1', '3', '4', '6']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run mobile/tests/map-data.test.ts`
Expected: FAIL; the first test with `undefined`, the second because `'6'` is missing.

- [ ] **Step 3: Add the coordinate**

In `mobile/src/features/map/coordinates.ts`, inside `RESTAURANT_COORDINATES`, after the Antico Pizza entry add:

```ts
  // Chick-fil-A, OpenStreetMap node 11952492844 (© OpenStreetMap contributors, ODbL). Seeded by
  // docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql.
  '10000000-0000-4000-8000-000000000006': { latitude: 33.760184, longitude: -84.387039 },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run mobile/tests/map-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the SQL file**

Create `docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql`:

```sql
-- Demo stopgap: seed Chick-fil-A so a Chick-fil-A receipt can be confirmed today.
-- Run once in the Supabase SQL editor (safe to re-run). It follows supabase/seed.sql.
-- Receipt lines must match a canonical name or alias EXACTLY (lowercased, whitespace trimmed;
-- punctuation counts). After your first real receipt, add the lines it printed as aliases below.

insert into public.restaurants (id, slug, name, location_label, category, aliases, theme)
values (
  '10000000-0000-4000-8000-000000000006', 'chick-fil-a-atlanta', 'Chick-fil-A', 'Atlanta · Peachtree Center', 'chicken',
  array['Chick-fil-A', 'Chick fil A', 'CFA'],
  '{"primaryColor":"#7A1F2B","accentColor":"#F1DEC6","fontKey":"friendly","patternKey":"none"}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  location_label = excluded.location_label,
  category = excluded.category,
  aliases = excluded.aliases,
  theme = excluded.theme;

insert into public.menu_items (id, restaurant_id, canonical_name, aliases)
values
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000006', 'Chick-fil-A Chicken Sandwich', array['chicken sandwich', 'chick-fil-a sandwich']),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000006', 'Spicy Chicken Sandwich', array['spicy chicken sandwich', 'spicy sandwich']),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000006', 'Deluxe Chicken Sandwich', array['deluxe sandwich', 'chicken sandwich deluxe']),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000006', 'Chick-fil-A Nuggets', array['nuggets', 'chicken nuggets', '8 count nuggets', '8 ct nuggets']),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000006', 'Chick-n-Strips', array['chick n strips', 'chicken strips', 'strips']),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000006', 'Waffle Potato Fries', array['waffle fries', 'fries', 'waffle potato fries medium']),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000006', 'Mac & Cheese', array['mac and cheese', 'macaroni and cheese']),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000006', 'Sweet Tea', array['iced tea', 'sweet iced tea']),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000006', 'Lemonade', array['chick-fil-a lemonade', 'iced lemonade']),
  ('20000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000006', 'Frosted Lemonade', array['frosted lemonade']),
  ('20000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000006', 'Chocolate Chunk Cookie', array['cookie', 'chocolate chunk cookie'])
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases;

-- Brand key for later brand matching (a no-op until the place-based migration adds the column):
-- update public.restaurants set brand_key = 'name:chick fil a' where slug = 'chick-fil-a-atlanta';
```

- [ ] **Step 6: Check the ids do not collide with the existing seed**

Run: `grep -n "10000000-0000-4000-8000-000000000006\|20000000-0000-4000-8000-0000000000\(16\|17\|18\|19\|2[0-6]\)" supabase/seed.sql`
Expected: no output.

- [ ] **Step 7: Run all tests and typecheck, then commit**

Run: `npm test` then `npm run typecheck`
Expected: both pass.

```bash
git add docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql mobile/src/features/map/coordinates.ts mobile/tests/map-data.test.ts
git commit -m "feat: seed script and map coordinate for a Chick-fil-A demo restaurant

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand the SQL to the user**

Tell the user to run `docs/superpowers/sql/2026-10-11-seed-chick-fil-a.sql` in the Supabase SQL editor, then scan the Chick-fil-A receipt. If any receipt line is rejected ("Choose a supported menu item"), add that line's text, lowercased, to the matching item's `aliases` and re-run the script. Do not run the SQL yourself.

---

### Task 2: Name scoring and place ranking

**Files:**
- Modify: `mobile/src/features/map/mergeNearby.ts` (export `brandKeyOf`)
- Create: `mobile/src/features/receipts/placeMatch.ts`
- Test: `mobile/tests/receipt-place-match.test.ts`

**Interfaces:**
- Consumes: `OsmPlace` (`mobile/src/features/map/osm.ts`), `normalizedName` (`mobile/src/features/map/mapRestaurants.ts`), `distanceKm`, `Coordinate` (`mobile/src/features/map/coordinates.ts`).
- Produces:
  - `type PlaceCandidate = { key: string; name: string; address: string | null; coordinate: Coordinate; osm: { type: 'node' | 'way' | 'relation'; id: number }; brandKey: string; isBrand: boolean; cuisine: string | null }`
  - `candidateFromOsm(place: OsmPlace): PlaceCandidate`
  - `nameScore(a: string, b: string): number`
  - `type ScoredPlace = { place: PlaceCandidate; nameScore: number; distanceMetres: number | null }`
  - `type PlaceMatch = { best: ScoredPlace | null; ranked: ScoredPlace[] }`
  - `matchReceiptToPlace(receiptName: string | null, user: Coordinate | null, places: PlaceCandidate[]): PlaceMatch`
  - `catalogRestaurantFor(candidate: Pick<PlaceCandidate, 'name' | 'brandKey'>, catalog: { id: string; name: string }[]): string | null`
  - constants `MATCH_NAME_SCORE = 0.8`, `MATCH_RADIUS_METRES = 300`, `LIST_RADIUS_METRES = 500`, `MAX_LISTED = 8`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/receipt-place-match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { OsmPlace } from '../src/features/map/osm';
import { candidateFromOsm, catalogRestaurantFor, matchReceiptToPlace, nameScore } from '../src/features/receipts/placeMatch';

const here = { latitude: 33.76, longitude: -84.387 };
const north = (metres: number) => ({ latitude: here.latitude + metres / 111195, longitude: here.longitude });

function osm(id: number, name: string, metresNorth: number, extra: Partial<OsmPlace> = {}): OsmPlace {
  return { osmType: 'node', osmId: id, key: `osm:node/${id}`, name, coordinate: north(metresNorth), amenity: 'fast_food', cuisine: null, address: null, city: null, ...extra };
}
const candidate = (...args: Parameters<typeof osm>) => candidateFromOsm(osm(...args));

describe('nameScore', () => {
  it('treats punctuation, case, accents and store numbers as the same name', () => {
    expect(nameScore('CHICK-FIL-A #01234', 'Chick-fil-A')).toBe(1);
    expect(nameScore("McDonald's", 'Mcdonalds')).toBe(1);
    expect(nameScore('Café Intermezzo', 'cafe intermezzo')).toBe(1);
  });

  it('scores a name inside a longer one as a strong match', () => {
    expect(nameScore('Chick-fil-A', 'Chick-fil-A Midtown')).toBe(0.85);
    expect(nameScore('Antico Pizza', 'Antico Pizza Napoletana')).toBe(0.85);
  });

  it('scores different restaurants low', () => {
    expect(nameScore('Chick-fil-A', 'Chicken Salad Chick')).toBeLessThan(0.5);
    expect(nameScore('Taco Bell', 'Taco Mac')).toBeLessThan(0.5);
    expect(nameScore('', 'Anything')).toBe(0);
  });
});

describe('candidateFromOsm', () => {
  it('carries the brand key and whether the place is a chain', () => {
    const chain = candidateFromOsm(osm(1, 'Chick-fil-A', 0, { brand: 'Chick-fil-A', brandWikidata: 'Q491516', cuisine: 'chicken', address: '1 Main St', city: 'Atlanta' }));
    expect(chain).toMatchObject({ key: 'osm:node/1', brandKey: 'wikidata:Q491516', isBrand: true, cuisine: 'chicken', address: '1 Main St, Atlanta', osm: { type: 'node', id: 1 } });
    const solo = candidateFromOsm(osm(2, 'Joe’s Diner', 0));
    expect(solo).toMatchObject({ brandKey: 'name:joe s diner', isBrand: false, address: null });
  });
});

describe('matchReceiptToPlace', () => {
  it('preselects the nearest place whose name matches, within 300 m', () => {
    const near = candidate(1, 'Chick-fil-A', 120);
    const far = candidate(2, 'Chick-fil-A', 450);
    const other = candidate(3, 'Taco Mac', 50);
    const { best, ranked } = matchReceiptToPlace('CHICK-FIL-A #01234', here, [far, other, near]);
    expect(best?.place.key).toBe(near.key);
    expect(ranked.map((entry) => entry.place.key)).toEqual([near.key, far.key, other.key]);
  });

  it('lists but does not preselect a matching place further than 300 m', () => {
    const result = matchReceiptToPlace('Chick-fil-A', here, [candidate(2, 'Chick-fil-A', 450)]);
    expect(result.best).toBeNull();
    expect(result.ranked).toHaveLength(1);
  });

  it('preselects nothing when the name does not match, but still lists what is close', () => {
    const result = matchReceiptToPlace('Wendys', here, [candidate(3, 'Taco Mac', 50)]);
    expect(result.best).toBeNull();
    expect(result.ranked).toHaveLength(1);
  });

  it('without a location, preselects nothing and lists by name only', () => {
    const result = matchReceiptToPlace('Chick-fil-A', null, [candidate(1, 'Taco Mac', 10), candidate(2, 'Chick-fil-A', 900)]);
    expect(result.best).toBeNull();
    expect(result.ranked[0].place.name).toBe('Chick-fil-A');
    expect(result.ranked[0].distanceMetres).toBeNull();
  });

  it('lists at most 8 places and none further than 500 m', () => {
    const many = Array.from({ length: 12 }, (_, index) => candidate(index + 1, `Place ${index}`, 10 + index * 10));
    const { ranked } = matchReceiptToPlace(null, here, [candidate(99, 'Faraway', 800), ...many]);
    expect(ranked).toHaveLength(8);
    expect(ranked.some((entry) => entry.place.name === 'Faraway')).toBe(false);
  });
});

describe('catalogRestaurantFor', () => {
  const catalog = [{ id: 'r-cfa', name: 'Chick-fil-A' }, { id: 'r-varsity', name: 'The Varsity' }];

  it('finds a seeded restaurant by brand key or by a similar name', () => {
    expect(catalogRestaurantFor(candidate(1, 'Chick-fil-A', 0, { brand: 'Chick-fil-A' }), catalog)).toBe('r-cfa');
    expect(catalogRestaurantFor(candidate(2, 'Chick-fil-A Midtown', 0), catalog)).toBe('r-cfa');
    expect(catalogRestaurantFor(candidate(3, 'The Varsity', 0), catalog)).toBe('r-varsity');
  });

  it('returns null when nothing in the catalog is the same restaurant, or when two are', () => {
    expect(catalogRestaurantFor(candidate(4, 'Taco Mac', 0), catalog)).toBeNull();
    const twoMatches = [...catalog, { id: 'r-cfa2', name: 'Chick-fil-A Midtown' }];
    expect(catalogRestaurantFor(candidate(5, 'Chick-fil-A', 0, { brandWikidata: 'Q1' }), twoMatches)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run mobile/tests/receipt-place-match.test.ts`
Expected: FAIL, cannot resolve `../src/features/receipts/placeMatch`.

- [ ] **Step 3: Export `brandKeyOf` from the map**

In `mobile/src/features/map/mergeNearby.ts` change the line

```ts
const brandKeyOf = (place: OsmPlace) => (place.brandWikidata ? `wikidata:${place.brandWikidata}` : nameKey(place));
```

to

```ts
export const brandKeyOf = (place: OsmPlace) => (place.brandWikidata ? `wikidata:${place.brandWikidata}` : nameKey(place));
```

- [ ] **Step 4: Write the minimal implementation**

Create `mobile/src/features/receipts/placeMatch.ts`:

```ts
import { distanceKm, type Coordinate } from '../map/coordinates';
import { normalizedName } from '../map/mapRestaurants';
import { brandKeyOf } from '../map/mergeNearby';
import type { OsmPlace } from '../map/osm';

// Matching a receipt to the place where it was printed: the name on the receipt, and where the
// user is. Pure functions only; the phone's location and the nearby places come in as arguments.

export const MATCH_NAME_SCORE = 0.8;
export const MATCH_RADIUS_METRES = 300;
export const LIST_RADIUS_METRES = 500;
export const MAX_LISTED = 8;

export type PlaceCandidate = {
  key: string;
  name: string;
  address: string | null;
  coordinate: Coordinate;
  osm: { type: 'node' | 'way' | 'relation'; id: number };
  /** Same format as the map's pins: 'wikidata:Q…' or 'name:<normalised>'. */
  brandKey: string;
  /** OpenStreetMap tags it as a brand, so every branch is one restaurant. */
  isBrand: boolean;
  cuisine: string | null;
};

export type ScoredPlace = { place: PlaceCandidate; nameScore: number; distanceMetres: number | null };
export type PlaceMatch = { best: ScoredPlace | null; ranked: ScoredPlace[] };

export function candidateFromOsm(place: OsmPlace): PlaceCandidate {
  return {
    key: place.key,
    name: place.name,
    address: [place.address, place.city].filter(Boolean).join(', ') || null,
    coordinate: place.coordinate,
    osm: { type: place.osmType, id: place.osmId },
    brandKey: brandKeyOf(place),
    isBrand: Boolean(place.brandWikidata || place.brand),
    cuisine: place.cuisine,
  };
}

// Words of a name without store numbers ("#01234" becomes nothing).
const words = (name: string) => normalizedName(name).split(' ').filter((word) => word !== '' && !/^\d+$/.test(word));

/** 1 for the same name, 0.85 for one name inside another, otherwise how many words they share. */
export function nameScore(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.length === 0 || right.length === 0) return 0;
  if (left.join('') === right.join('')) return 1;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  const longWords = new Set(long);
  if (short.every((word) => longWords.has(word)) && short.join('').length >= 4) return 0.85;
  const shared = short.filter((word) => longWords.has(word)).length;
  return shared / new Set([...left, ...right]).size;
}

export function matchReceiptToPlace(receiptName: string | null, user: Coordinate | null, places: PlaceCandidate[]): PlaceMatch {
  const scored: ScoredPlace[] = places.map((place) => ({
    place,
    nameScore: receiptName ? nameScore(receiptName, place.name) : 0,
    distanceMetres: user ? Math.round(distanceKm(user, place.coordinate) * 1000) : null,
  }));
  const close = user ? scored.filter((entry) => (entry.distanceMetres as number) <= LIST_RADIUS_METRES) : scored;
  const ranked = [...close]
    .sort((a, b) => b.nameScore - a.nameScore || (a.distanceMetres ?? 0) - (b.distanceMetres ?? 0))
    .slice(0, MAX_LISTED);
  const best = user
    ? ranked
        .filter((entry) => entry.nameScore >= MATCH_NAME_SCORE && (entry.distanceMetres as number) <= MATCH_RADIUS_METRES)
        .sort((a, b) => (a.distanceMetres as number) - (b.distanceMetres as number))[0] ?? null
    : null;
  return { best, ranked };
}

/** The id of the one catalog restaurant that is this place, or null when none or several are. */
export function catalogRestaurantFor(candidate: Pick<PlaceCandidate, 'name' | 'brandKey'>, catalog: { id: string; name: string }[]): string | null {
  const exact = catalog.find((restaurant) => `name:${normalizedName(restaurant.name)}` === candidate.brandKey);
  if (exact) return exact.id;
  const similar = catalog.filter((restaurant) => nameScore(restaurant.name, candidate.name) >= MATCH_NAME_SCORE);
  return similar.length === 1 ? similar[0].id : null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run mobile/tests/receipt-place-match.test.ts mobile/tests/map-osm.test.ts`
Expected: PASS (the map tests confirm `brandKeyOf` still works).

- [ ] **Step 6: Run everything, then commit**

Run: `npm test` then `npm run typecheck`
Expected: both pass.

```bash
git add mobile/src/features/map/mergeNearby.ts mobile/src/features/receipts/placeMatch.ts mobile/tests/receipt-place-match.test.ts
git commit -m "feat: match a receipt's restaurant name and the user's location to nearby places

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Search by name (Nominatim)

**Files:**
- Create: `mobile/src/features/receipts/placeSearch.ts`
- Create: `mobile/src/features/receipts/placeSearchClient.ts`
- Test: `mobile/tests/receipt-place-search.test.ts`

**Interfaces:**
- Consumes: `candidateFromOsm`, `PlaceCandidate` (Task 2); `OsmPlace`.
- Produces:
  - `type SearchFetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>`
  - `class PlaceSearchError extends Error { status: number }`
  - `createPlaceSearch(options: { fetcher: SearchFetcher; now?: () => number; sleep?: (ms: number) => Promise<void> }): { search(name: string, near?: Coordinate | null): Promise<PlaceCandidate[]> }`
  - `placeSearch` (the shared instance) from `placeSearchClient.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/receipt-place-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlaceSearch, PlaceSearchError } from '../src/features/receipts/placeSearch';

const sample = [
  {
    osm_type: 'node', osm_id: 11952492844, lat: '33.760184', lon: '-84.387039', category: 'amenity', type: 'fast_food',
    name: 'Chick-fil-A', display_name: 'Chick-fil-A, Peachtree Center Ave NE, Atlanta, Georgia',
    extratags: { brand: 'Chick-fil-A', 'brand:wikidata': 'Q491516', cuisine: 'chicken;sandwich' },
    address: { house_number: '233', road: 'Peachtree Center Ave NE', city: 'Atlanta' },
  },
  { osm_type: 'way', osm_id: 5, lat: '33.7', lon: '-84.3', category: 'highway', type: 'residential', name: 'Pizza Street', display_name: 'Pizza Street, Atlanta' },
  { osm_type: 'node', osm_id: 6, lat: 'x', lon: '-84.3', category: 'amenity', type: 'restaurant', name: 'Bad Coordinates' },
];

function setup(status = 200) {
  const calls: { url: string; headers?: Record<string, string> }[] = [];
  const waits: number[] = [];
  const fetcher = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers });
    return { ok: status === 200, status, json: async () => sample };
  };
  const search = createPlaceSearch({ fetcher, now: () => 1000, sleep: async (ms) => { waits.push(ms); } });
  return { search, calls, waits };
}

describe('place search', () => {
  it('keeps only restaurants, fast food and cafes with usable coordinates, and maps their tags', async () => {
    const { search, calls } = setup();
    const found = await search.search('Chick-fil-A');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      key: 'osm:node/11952492844', name: 'Chick-fil-A', brandKey: 'wikidata:Q491516', isBrand: true,
      cuisine: 'chicken', address: '233 Peachtree Center Ave NE, Atlanta',
      coordinate: { latitude: 33.760184, longitude: -84.387039 },
    });
    expect(calls[0].url).toContain('https://nominatim.openstreetmap.org/search?q=Chick-fil-A');
    expect(calls[0].headers?.['User-Agent']).toContain('FoodieCards');
  });

  it('asks once per query, ignoring case and spaces', async () => {
    const { search, calls } = setup();
    await search.search('chick-fil-a');
    await search.search('  CHICK-FIL-A ');
    expect(calls).toHaveLength(1);
  });

  it('waits at least 1.1 seconds between different requests', async () => {
    const { search, waits } = setup();
    await search.search('chick-fil-a');
    await search.search('pizza');
    expect(waits).toEqual([1100]);
  });

  it('biases results toward where the user is without restricting them', async () => {
    const { search, calls } = setup();
    await search.search('chick-fil-a', { latitude: 33.76, longitude: -84.387 });
    expect(calls[0].url).toContain('viewbox=');
    expect(calls[0].url).toContain('bounded=0');
  });

  it('does not call the network for a query under two characters', async () => {
    const { search, calls } = setup();
    expect(await search.search(' a ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('throws a clear error when the service says to slow down', async () => {
    const { search } = setup(429);
    await expect(search.search('chick-fil-a')).rejects.toMatchObject({ name: 'PlaceSearchError', status: 429 });
    await expect(setup(429).search.search('x1')).rejects.toBeInstanceOf(PlaceSearchError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run mobile/tests/receipt-place-search.test.ts`
Expected: FAIL, cannot resolve `placeSearch`.

- [ ] **Step 3: Write the minimal implementation**

Create `mobile/src/features/receipts/placeSearch.ts`:

```ts
import type { Coordinate } from '../map/coordinates';
import type { OsmPlace } from '../map/osm';
import { candidateFromOsm, type PlaceCandidate } from './placeMatch';

// Looking a restaurant up by name in OpenStreetMap's Nominatim, for when no nearby place matched.
// Nominatim's policy: an identifying User-Agent, at most one request a second, no bulk use. This
// is called only when the user taps Search, and answers are cached.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FoodieCards/1.0 (Hacklanta student project; https://github.com/nnguyen402/foodie-cards)';
const MIN_GAP_MS = 1100;
const FOOD_TYPES = new Set(['restaurant', 'fast_food', 'cafe']);
const VIEW_SPAN_DEGREES = 0.15;

export type SearchFetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class PlaceSearchError extends Error {
  constructor(public status: number) {
    super(status === 429 ? 'Search is busy. Try again in a moment.' : `Search failed (HTTP ${status}).`);
    this.name = 'PlaceSearchError';
  }
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

function placeFromResult(raw: unknown): PlaceCandidate | null {
  const result = record(raw);
  const type = result.osm_type;
  const category = result.category ?? result.class;
  const amenity = text(result.type);
  if ((type !== 'node' && type !== 'way' && type !== 'relation') || typeof result.osm_id !== 'number') return null;
  if (category !== 'amenity' || !amenity || !FOOD_TYPES.has(amenity)) return null;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  const name = text(result.name) ?? text(String(result.display_name ?? '').split(',')[0]);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const tags = record(result.extratags);
  const address = record(result.address);
  const street = [text(address.house_number), text(address.road)].filter(Boolean).join(' ');
  const place: OsmPlace = {
    osmType: type,
    osmId: result.osm_id,
    key: `osm:${type}/${result.osm_id}`,
    name,
    coordinate: { latitude, longitude },
    amenity,
    cuisine: text(tags.cuisine)?.split(';')[0].trim().toLowerCase() || null,
    address: street === '' ? null : street,
    city: text(address.city) ?? text(address.town) ?? text(address.village),
    brand: text(tags.brand),
    brandWikidata: text(tags['brand:wikidata']),
  };
  return candidateFromOsm(place);
}

type Options = { fetcher: SearchFetcher; now?: () => number; sleep?: (ms: number) => Promise<void> };

export function createPlaceSearch({ fetcher, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: Options) {
  const cache = new Map<string, PlaceCandidate[]>();
  let lastRequestAt = -Infinity;

  return {
    async search(name: string, near: Coordinate | null = null): Promise<PlaceCandidate[]> {
      const query = name.trim();
      if (query.length < 2) return [];
      const key = `${query.toLowerCase()}|${near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : ''}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const wait = lastRequestAt + MIN_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = now();

      const params = [`q=${encodeURIComponent(query)}`, 'format=jsonv2', 'limit=10', 'addressdetails=1', 'extratags=1'];
      if (near) {
        // A hint to rank nearby results first, not a limit.
        const d = VIEW_SPAN_DEGREES;
        params.push(`viewbox=${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`, 'bounded=0');
      }
      const response = await fetcher(`${ENDPOINT}?${params.join('&')}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!response.ok) throw new PlaceSearchError(response.status);
      const body = await response.json();
      const found = Array.isArray(body) ? body.flatMap((raw) => { const place = placeFromResult(raw); return place ? [place] : []; }) : [];
      cache.set(key, found);
      return found;
    },
  };
}
```

Create `mobile/src/features/receipts/placeSearchClient.ts`:

```ts
import { createPlaceSearch } from './placeSearch';

// One instance for the whole session, so its cache and its one-request-a-second gap are shared.
export const placeSearch = createPlaceSearch({ fetcher: (url, init) => fetch(url, init) });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run mobile/tests/receipt-place-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Run everything, then commit**

Run: `npm test` then `npm run typecheck`
Expected: both pass.

```bash
git add mobile/src/features/receipts/placeSearch.ts mobile/src/features/receipts/placeSearchClient.ts mobile/tests/receipt-place-search.test.ts
git commit -m "feat: look up a restaurant by name in OpenStreetMap with a rate limit and cache

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nearby places and the location hook

**Files:**
- Create: `mobile/src/features/map/nearbyPlaces.ts`
- Create: `mobile/src/features/map/nearbyClient.ts`
- Modify: `mobile/src/features/map/useMapRestaurants.ts`
- Create: `mobile/src/features/receipts/usePlaceMatch.ts`
- Test: `mobile/tests/map-nearby-places.test.ts`

**Interfaces:**
- Consumes: `NearbySource` (`mobile/src/features/map/nearbySource.ts`: `cached(centre): OsmPlace[] | null`, `restore(centre): Promise<{ places: OsmPlace[]; fresh: boolean } | null>`, `load(centre): Promise<OsmPlace[]>`); `matchReceiptToPlace`, `candidateFromOsm`, `PlaceMatch` (Task 2).
- Produces:
  - `nearbyPlacesFor(source: Pick<NearbySource, 'cached' | 'restore' | 'load'>, centre: Coordinate): Promise<OsmPlace[]>`
  - `nearbySource` (shared instance) from `nearbyClient.ts`
  - `type PlaceMatchState = { status: 'locating' | 'loading' | 'ready' | 'no-location' | 'failed'; coordinate: Coordinate | null; match: PlaceMatch }`
  - `usePlaceMatch(receiptName: string | null, enabled: boolean): PlaceMatchState`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/map-nearby-places.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { nearbyPlacesFor } from '../src/features/map/nearbyPlaces';
import type { OsmPlace } from '../src/features/map/osm';

const centre = { latitude: 33.76, longitude: -84.387 };
const place = (id: number): OsmPlace => ({ osmType: 'node', osmId: id, key: `osm:node/${id}`, name: `Place ${id}`, coordinate: centre, amenity: 'restaurant', cuisine: null, address: null, city: null });

function source(parts: { cached?: OsmPlace[] | null; restored?: { places: OsmPlace[]; fresh: boolean } | null; load?: () => Promise<OsmPlace[]> }) {
  return {
    cached: vi.fn(() => parts.cached ?? null),
    restore: vi.fn(async () => parts.restored ?? null),
    load: vi.fn(parts.load ?? (async () => [place(9)])),
  };
}

describe('nearbyPlacesFor', () => {
  it('uses the session cache without touching storage or the network', async () => {
    const s = source({ cached: [place(1)] });
    expect(await nearbyPlacesFor(s, centre)).toEqual([place(1)]);
    expect(s.restore).not.toHaveBeenCalled();
    expect(s.load).not.toHaveBeenCalled();
  });

  it('uses a fresh saved copy without a request', async () => {
    const s = source({ restored: { places: [place(2)], fresh: true } });
    expect(await nearbyPlacesFor(s, centre)).toEqual([place(2)]);
    expect(s.load).not.toHaveBeenCalled();
  });

  it('loads when the saved copy is stale', async () => {
    const s = source({ restored: { places: [place(2)], fresh: false } });
    expect(await nearbyPlacesFor(s, centre)).toEqual([place(9)]);
    expect(s.load).toHaveBeenCalledTimes(1);
  });

  it('falls back to a stale saved copy when loading fails', async () => {
    const s = source({ restored: { places: [place(2)], fresh: false }, load: async () => { throw new Error('504'); } });
    expect(await nearbyPlacesFor(s, centre)).toEqual([place(2)]);
  });

  it('throws when there is nothing saved and loading fails', async () => {
    const s = source({ load: async () => { throw new Error('504'); } });
    await expect(nearbyPlacesFor(s, centre)).rejects.toThrow('504');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run mobile/tests/map-nearby-places.test.ts`
Expected: FAIL, cannot resolve `nearbyPlaces`.

- [ ] **Step 3: Write the pure loader**

Create `mobile/src/features/map/nearbyPlaces.ts`:

```ts
import type { Coordinate } from './coordinates';
import type { NearbySource } from './nearbySource';
import type { OsmPlace } from './osm';

/** Nearby places for a spot: the session cache, then a fresh saved copy, then the network, then a stale saved copy. */
export async function nearbyPlacesFor(source: Pick<NearbySource, 'cached' | 'restore' | 'load'>, centre: Coordinate): Promise<OsmPlace[]> {
  const cached = source.cached(centre);
  if (cached) return cached;
  const restored = await source.restore(centre);
  if (restored?.fresh) return restored.places;
  try {
    return await source.load(centre);
  } catch (error) {
    if (restored) return restored.places;
    throw error;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run mobile/tests/map-nearby-places.test.ts`
Expected: PASS.

- [ ] **Step 5: Share the `nearbySource` instance**

Create `mobile/src/features/map/nearbyClient.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNearbySource } from './nearbySource';

// One client for the whole session, so its cache survives leaving and returning to a tab, and
// the map and the receipt screen share what they have already fetched.
export const nearbySource = createNearbySource({ fetcher: (url, init) => fetch(url, init), storage: AsyncStorage, log: (message) => console.warn(message) });
```

In `mobile/src/features/map/useMapRestaurants.ts` remove the lines

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
```
```ts
import { createNearbySource } from './nearbySource';
```
```ts
// One client for the whole session, so its cache survives leaving and returning to the tab.
const nearbySource = createNearbySource({ fetcher: (url, init) => fetch(url, init), storage: AsyncStorage, log: (message) => console.warn(message) });
```

and add `import { nearbySource } from './nearbyClient';` next to the other imports.

- [ ] **Step 6: Write the hook**

Create `mobile/src/features/receipts/usePlaceMatch.ts`:

```ts
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '../map/coordinates';
import { nearbySource } from '../map/nearbyClient';
import { nearbyPlacesFor } from '../map/nearbyPlaces';
import { candidateFromOsm, matchReceiptToPlace, type PlaceMatch } from './placeMatch';

export type PlaceMatchState = {
  status: 'locating' | 'loading' | 'ready' | 'no-location' | 'failed';
  coordinate: Coordinate | null;
  match: PlaceMatch;
};

const EMPTY: PlaceMatch = { best: null, ranked: [] };

/** Where the user is and which nearby place the receipt's restaurant name fits. Nearby lookup may send the coordinate to public Overpass; the app backend only receives the chosen place's coordinates. */
export function usePlaceMatch(receiptName: string | null, enabled: boolean): PlaceMatchState {
  const [state, setState] = useState<PlaceMatchState>({ status: 'locating', coordinate: null, match: EMPTY });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (active) setState({ status: 'no-location', coordinate: null, match: EMPTY });
          return;
        }
        const fix = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const coordinate = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
        if (!active) return;
        setState({ status: 'loading', coordinate, match: EMPTY });
        const places = await nearbyPlacesFor(nearbySource, coordinate);
        if (!active) return;
        setState({ status: 'ready', coordinate, match: matchReceiptToPlace(receiptName, coordinate, places.map(candidateFromOsm)) });
      } catch {
        if (active) setState((current) => ({ ...current, status: current.coordinate ? 'failed' : 'no-location' }));
      }
    })();
    return () => { active = false; };
  }, [receiptName, enabled]);

  return state;
}
```

- [ ] **Step 7: Run everything, then commit**

Run: `npm test` then `npm run typecheck`
Expected: both pass. The map's behaviour is unchanged: `useMapRestaurants` only moved where its source is created.

```bash
git add mobile/src/features/map/nearbyPlaces.ts mobile/src/features/map/nearbyClient.ts mobile/src/features/map/useMapRestaurants.ts mobile/src/features/receipts/usePlaceMatch.ts mobile/tests/map-nearby-places.test.ts
git commit -m "feat: load nearby places for a receipt from the shared map source

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The picker on the confirm screen

**Files:**
- Create: `mobile/src/features/receipts/placeSupport.ts`
- Create: `mobile/src/features/receipts/PlacePicker.tsx`
- Modify: `mobile/app/receipt/confirm.tsx`

**Interfaces:**
- Consumes: `PlaceMatchState`, `usePlaceMatch` (Task 4); `PlaceCandidate`, `catalogRestaurantFor`, `ScoredPlace` (Task 2); `placeSearch` (Task 3).
- Produces: `PLACE_SUBMIT_SUPPORTED: boolean` and the `PlacePicker` component. Nathan's `confirm.tsx` keeps its own state; this task adds one `pickedPlace` state and one render block.

This task has no automated test (it is a screen); it is verified by typecheck and the on-device steps below.

- [ ] **Step 1: Add the switch**

Create `mobile/src/features/receipts/placeSupport.ts`:

```ts
// Whether the server accepts a `place` on submit, creating a restaurant that is not in our table.
// Keep false until the shared contract, migration and server from
// docs/superpowers/handoff/2026-10-11-place-based-submit-for-nathan.md are in. While false, only a
// place that is one of our own restaurants can be confirmed.
export const PLACE_SUBMIT_SUPPORTED = false;
```

- [ ] **Step 2: Write the picker**

Create `mobile/src/features/receipts/PlacePicker.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { colors, radius, spacing } from '@/theme/tokens';
import type { PlaceCandidate, ScoredPlace } from './placeMatch';
import type { PlaceMatchState } from './usePlaceMatch';

type PlacePickerProps = {
  receiptName: string | null;
  state: PlaceMatchState;
  picked: PlaceCandidate | null;
  /** Why the picked place cannot be confirmed yet, or null when it can. */
  blockedReason: string | null;
  onPick: (place: PlaceCandidate) => void;
  onSearch: (name: string) => Promise<PlaceCandidate[]>;
};

const metres = (value: number | null) => (value === null ? '' : value < 1000 ? ` · ${value} m` : ` · ${(value / 1000).toFixed(1)} km`);

export function PlacePicker({ receiptName, state, picked, blockedReason, onPick, onSearch }: PlacePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(receiptName ?? '');
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const suggested = picked ?? state.match.best?.place ?? null;
  const distance = suggested ? (state.match.ranked.find((entry) => entry.place.key === suggested.key)?.distanceMetres ?? null) : null;
  const working = state.status === 'locating' || state.status === 'loading';

  async function runSearch() {
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await onSearch(query));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  const row = (place: PlaceCandidate, extra: string) => (
    <Pressable key={place.key} accessibilityRole="button" accessibilityLabel={`Use ${place.name}`} onPress={() => { onPick(place); setOpen(false); }} style={styles.row}>
      <View style={styles.flex}>
        <AppText strong>{place.name}</AppText>
        <AppText variant="small" muted>{[place.address, extra].filter(Boolean).join('')}</AppText>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <AppText variant="heading" strong>Where you ate</AppText>
      {working ? <View style={styles.inline}><ActivityIndicator color={colors.accent} /><AppText variant="small" muted>Finding where you ate…</AppText></View> : null}
      {suggested ? (
        <View style={styles.suggestion}>
          <AppText variant="small" muted>{picked ? 'You chose' : 'We think you ate at'}</AppText>
          <AppText variant="heading" strong>{suggested.name}{metres(distance)}</AppText>
          {suggested.address ? <AppText variant="small" muted>{suggested.address}</AppText> : null}
          {!picked ? <Button label="Use this restaurant" onPress={() => onPick(suggested)} testID="use-suggested-place" /> : null}
        </View>
      ) : !working ? (
        <AppText variant="small" muted>
          {state.status === 'no-location' ? 'Location is off, so search for the restaurant by name.' : 'No nearby place matched this receipt. Search by name or choose one nearby.'}
        </AppText>
      ) : null}
      {blockedReason ? <AppText variant="small" style={styles.blocked}>{blockedReason}</AppText> : null}
      <Button label={open ? 'Hide other places' : 'Choose another'} variant="quiet" fullWidth={false} onPress={() => setOpen((value) => !value)} testID="choose-another-place" />
      {open ? (
        <View style={styles.list}>
          {state.match.ranked.map((entry: ScoredPlace) => row(entry.place, metres(entry.distanceMetres)))}
          <FormField label="Search by name" value={query} onChangeText={setQuery} placeholder="Restaurant name" testID="place-search-input" />
          <Button label="Search" variant="secondary" onPress={() => void runSearch()} loading={searching} disabled={query.trim().length < 2} testID="place-search-button" />
          {searchError ? <AppText variant="small" style={styles.blocked}>{searchError}</AppText> : null}
          {results && results.length === 0 ? <AppText variant="small" muted>No restaurants found for that name.</AppText> : null}
          {results?.map((place) => row(place, ''))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  suggestion: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.control, backgroundColor: colors.accentSoft },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { gap: spacing.sm },
  row: { minHeight: 56, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  flex: { flex: 1, gap: spacing.xs },
  blocked: { color: colors.error },
});
```

- [ ] **Step 3: Mount it in the confirm screen**

In `mobile/app/receipt/confirm.tsx` make exactly these edits:

1. Add imports after the existing `import { MessagePanel } ...` line:

```ts
import { PlacePicker } from '@/features/receipts/PlacePicker';
import { catalogRestaurantFor, type PlaceCandidate } from '@/features/receipts/placeMatch';
import { PLACE_SUBMIT_SUPPORTED } from '@/features/receipts/placeSupport';
import { placeSearch } from '@/features/receipts/placeSearchClient';
import { usePlaceMatch } from '@/features/receipts/usePlaceMatch';
```

2. After the line `const [restaurantId, setRestaurantId] = useState('');` add:

```ts
  const [pickedPlace, setPickedPlace] = useState<PlaceCandidate | null>(null);
  const placeMatch = usePlaceMatch(draft?.restaurantName ?? null, draft !== null);
```

3. After the `updateItem` function add:

```ts
  function pickPlace(place: PlaceCandidate) {
    setPickedPlace(place);
    const catalogId = catalogRestaurantFor(place, restaurants);
    if (catalogId) {
      setRestaurantId(catalogId);
      setError(null);
    }
  }

  // A clear name-and-distance match is chosen for the user, unless they already chose.
  const suggestedPlace = placeMatch.match.best?.place ?? null;
  useEffect(() => {
    if (suggestedPlace && !pickedPlace && !restaurantId && restaurants.length > 0) pickPlace(suggestedPlace);
  }, [suggestedPlace, pickedPlace, restaurantId, restaurants]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBlockedReason = pickedPlace && !catalogRestaurantFor(pickedPlace, restaurants) && !PLACE_SUBMIT_SUPPORTED
    ? 'This restaurant is not in our catalog yet, so a card cannot be created for it from a receipt. Choose one of ours below.'
    : null;
```

4. Immediately before the `<View style={styles.card}><AppText variant="heading" strong>Restaurant</AppText>` line in the returned JSX add:

```tsx
    <PlacePicker receiptName={draft?.restaurantName ?? null} state={placeMatch} picked={pickedPlace} blockedReason={placeBlockedReason} onPick={pickPlace} onSearch={(name) => placeSearch.search(name, placeMatch.coordinate)} />
```

- [ ] **Step 4: Typecheck and run the tests**

Run: `npm run typecheck` then `npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/receipts/placeSupport.ts mobile/src/features/receipts/PlacePicker.tsx mobile/app/receipt/confirm.tsx
git commit -m "feat: suggest where you ate on the confirm screen from the receipt name and location

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Verify on a phone (the user does this)**

Reload Expo Go, scan a receipt near the restaurant, and check:
1. The "Where you ate" card shows "We think you ate at <name> · <distance>". If that restaurant is in our catalog (Chick-fil-A after Task 1's SQL), the matching restaurant in the list below is selected.
2. Tap **Choose another**: nearby places are listed; **Search** finds a restaurant by name.
3. Pick a restaurant that is not in our catalog: the red note says a card cannot be created yet, and **Confirm receipt** still asks for a supported restaurant.
4. Turn location off: the card says location is off and offers search.

---

### Task 6: The hand-off for Nathan

**Files:**
- Create: `docs/superpowers/handoff/2026-10-11-place-based-submit-for-nathan.md`

**Interfaces:**
- Produces: the contract and SQL that Phase 2 of this plan depends on.

- [ ] **Step 1: Write the hand-off document**

Create `docs/superpowers/handoff/2026-10-11-place-based-submit-for-nathan.md`. Everything below is a proposal for Nathan to adapt, not applied code.

````markdown
# Place-based submit: proposal for Nathan

Context: `docs/superpowers/specs/2026-10-11-place-based-restaurants-design.md`. The app (Lane C) already
suggests the restaurant from the receipt name and the user's location. What it cannot do is create a
card for a restaurant that is not in `restaurants`. These are the shared and backend pieces it needs.
The app flips `PLACE_SUBMIT_SUPPORTED` in `mobile/src/features/receipts/placeSupport.ts` once they land.

## 1. Shared contract (`shared/contracts.ts`)

```ts
export const confirmedPlaceSchema = z.object({
  osmType: z.enum(['node', 'way', 'relation']),
  osmId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(160).optional(),
  // Only sent for a place OpenStreetMap tags as a brand: 'wikidata:Q491516' or 'name:chick fil a'.
  brandKey: z.string().trim().min(1).max(160).optional(),
  cuisine: z.string().trim().max(40).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();
export type ConfirmedPlace = z.infer<typeof confirmedPlaceSchema>;
```

`confirmedReceiptSchema` changes `restaurantId: z.string().min(1)` to `restaurantId: z.string().min(1).optional()`,
adds `place: confirmedPlaceSchema.optional()`, and requires exactly one of the two:

```ts
.refine((value) => (value.restaurantId === undefined) !== (value.place === undefined), 'Send a restaurantId or a place, not both')
```

`safeConfirmedReceiptSchema` in the server must accept the same shape.

## 2. Migration (new file, e.g. `supabase/migrations/20261011000200_place_restaurants.sql`)

```sql
alter table public.restaurants
  add column source text not null default 'catalog' check (source in ('catalog', 'osm')),
  add column osm_type text check (osm_type in ('node', 'way', 'relation')),
  add column osm_id bigint,
  add column brand_key text,
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column created_by uuid references auth.users(id) on delete set null,
  add constraint restaurants_osm_pair check ((osm_type is null) = (osm_id is null));

create unique index restaurants_osm_unique on public.restaurants (osm_type, osm_id) where osm_id is not null;
create unique index restaurants_brand_unique on public.restaurants (brand_key) where brand_key is not null;

-- Same format the app builds from normalizedName(): lowercase, accents and punctuation to spaces,
-- a leading "the" dropped.
update public.restaurants set brand_key = case slug
  when 'busy-bee-cafe-west-end' then 'name:busy bee cafe'
  when 'fox-bros-bbq-dekalb-ave' then 'name:fox bros bar b q'
  when 'mary-macs-tea-room' then 'name:mary mac s tea room'
  when 'the-varsity-atlanta' then 'name:varsity'
  when 'antico-pizza-west-midtown' then 'name:antico pizza'
  when 'chick-fil-a-atlanta' then 'name:chick fil a'
end
where brand_key is null and slug in ('busy-bee-cafe-west-end', 'fox-bros-bbq-dekalb-ave', 'mary-macs-tea-room', 'the-varsity-atlanta', 'antico-pizza-west-midtown', 'chick-fil-a-atlanta');

create function public.resolve_place_restaurant(p_user_id uuid, p_place jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_brand text := nullif(btrim(p_place ->> 'brandKey'), '');
  v_type text := p_place ->> 'osmType';
  v_osm bigint := (p_place ->> 'osmId')::bigint;
  v_name text := btrim(coalesce(p_place ->> 'name', ''));
  v_id uuid;
  v_slug text;
begin
  if char_length(v_name) not between 1 and 120 or v_type not in ('node', 'way', 'relation') or v_osm is null then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: the place is invalid';
  end if;

  select r.id into v_id from public.restaurants r
  where (v_brand is not null and r.brand_key = v_brand) or (r.osm_type = v_type and r.osm_id = v_osm)
  limit 1;
  if v_id is not null then return v_id; end if;

  if (select count(*) from public.restaurants r where r.created_by = p_user_id and r.created_at > now() - interval '24 hours') >= 5 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED: too many new restaurants today';
  end if;

  v_slug := coalesce(nullif(trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'place')
            || '-' || v_type || '-' || v_osm;

  begin
    insert into public.restaurants (slug, name, location_label, category, source, osm_type, osm_id, brand_key, latitude, longitude, created_by)
    values (
      v_slug, v_name,
      left(coalesce(nullif(btrim(p_place ->> 'address'), ''), 'Nearby'), 160),
      left(coalesce(nullif(lower(btrim(split_part(coalesce(p_place ->> 'cuisine', ''), ';', 1))), ''), 'restaurant'), 40),
      'osm', v_type, v_osm, v_brand,
      (p_place ->> 'latitude')::double precision, (p_place ->> 'longitude')::double precision, p_user_id
    )
    returning id into v_id;
  exception when unique_violation then
    select r.id into v_id from public.restaurants r
    where (v_brand is not null and r.brand_key = v_brand) or (r.osm_type = v_type and r.osm_id = v_osm)
    limit 1;
  end;
  return v_id;
end;
$function$;

revoke all on function public.resolve_place_restaurant(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.resolve_place_restaurant(uuid, jsonb) to service_role;

-- Menu items for restaurants without a curated menu: one per confirmed line.
create function public.ensure_menu_items(p_restaurant_id uuid, p_names text[])
returns table (id uuid, canonical_name text, aliases text[])
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.source = 'osm') then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: only place restaurants get generated menus';
  end if;
  insert into public.menu_items (restaurant_id, canonical_name)
  select p_restaurant_id, btrim(n) from unnest(p_names) as n where char_length(btrim(n)) between 1 and 120
  on conflict (restaurant_id, canonical_name) do nothing;
  return query
    select m.id, m.canonical_name, m.aliases from public.menu_items m
    where m.restaurant_id = p_restaurant_id and m.canonical_name = any (select btrim(n) from unnest(p_names) as n);
end;
$function$;

revoke all on function public.ensure_menu_items(uuid, text[]) from public, anon, authenticated;
grant execute on function public.ensure_menu_items(uuid, text[]) to service_role;
```

## 3. Server (`POST /api/receipts/submit` in `server/src/app.ts`)

After the draft is loaded and checked, before `loadMenu`:

1. If `input.place` is present, the guard: the draft's `restaurantName` must fuzzy-match `place.name`
   (or the brand name). Reuse the app's rule: equal words ignoring punctuation, case and store numbers,
   or one name's words inside the other's (the app's `nameScore >= 0.8`). If not, return
   `400 INVALID_RECEIPT` "The receipt does not match the chosen place."
2. `restaurantId = await resolvePlace(userId, input.place)` (calls `resolve_place_restaurant`).
3. Menu: for a `source = 'osm'` restaurant call `ensure_menu_items(restaurantId, input.items.map((i) => i.confirmedName))`
   and pass the returned rows to `canonicalizeReceiptItems` in place of `loadMenu`; seeded restaurants keep `loadMenu`.
4. Everything after that (acceptance, rewards, replay by `submissionId`) is unchanged.

Open question for you: auto-created menu items change how "dishes tried" counts toward XP. Confirm the rule.

## 4. Tests to add (server)

Submit with `place` creates once and reuses afterwards; two branches with the same `brandKey` share a row;
a name mismatch is rejected; the sixth new restaurant in 24 hours is rejected; seeded submits are unchanged.
````

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/handoff/2026-10-11-place-based-submit-for-nathan.md
git commit -m "docs: proposed contract, migration and server changes for place-based submit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Send it to Nathan**

Tell the user to send Nathan the hand-off file path and the spec path. Do not apply any of it.

---

## Phase 2 (after Nathan's contract, migration and server are merged)

Write a short follow-up plan then, because its code depends on his final schema. It will:

1. Flip `PLACE_SUBMIT_SUPPORTED` to `true` and extend `submit()` in `confirm.tsx` to send `place` (built from the picked `PlaceCandidate`: OSM type and id, name, address, `latitude`/`longitude` of the place, `cuisine`, and `brandKey` only when `isBrand`) when the picked place is not a catalog restaurant. Test the payload builder.
2. Add `brand_key,latitude,longitude` to `RESTAURANT_SELECT` in `mobile/src/features/cards/collection.ts`, and make `buildMapRestaurants` use the row's `brand_key` and stored coordinates (the existing `coordinateFor` already prefers them).
3. Retire the mobile-side coordinates entry for Chick-fil-A from Task 1.
4. Re-run the on-device check from Task 5, plus: a second visit to a different branch adds to the same card.

## Self-Review

- **Spec coverage:** decisions 1 to 4 and pieces 0, 3 (matching, picker, name search, location handling) and the hand-off for 1 and 2 map to Tasks 1 to 6. Piece 4 (map and cards use the new columns) is Phase 2, deliberately, because those columns do not exist yet. The spec's guard rails, resolve function and menu fallback are in the hand-off (Task 6).
- **Placeholders:** none.
- **Type consistency:** `PlaceCandidate`, `PlaceMatch`, `ScoredPlace`, `PlaceMatchState`, `nearbyPlacesFor`, `createPlaceSearch`/`placeSearch`, `catalogRestaurantFor` and `PLACE_SUBMIT_SUPPORTED` are spelled the same in every task that uses them.
- **Review Focus:** items 1 to 6 each have a named test in Tasks 2 to 4.
