# Place-based restaurants (Lane C: app + stopgap + contract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scanning a receipt preselects the restaurant from the receipt name and the user's location (or a name search), and submits a `place` for restaurants we have never seen.

**Architecture:** A pure matcher (`matchReceiptToPlace`) ranks nearby OSM places and seeded restaurants by name score and distance. The confirm screen shows the best match with "Choose another" and "Search by name" (Nominatim). The submit payload carries exactly one of `restaurantId` or `place`. The backend pieces (migration, resolve function, server) are Nathan's and are out of this plan.

**Tech Stack:** TypeScript, zod (`shared/contracts.ts`), Expo / React Native, vitest (`npm test` from repo root).

**Spec:** `docs/superpowers/specs/2026-10-11-place-based-restaurants-design.md`

## Global Constraints

- The user's exact location never leaves the phone; only the chosen place's own coordinates are sent.
- Art stays keyed by cuisine only: no restaurant, chain, logo or mascot names in art files, keys or ability lines.
- Brand keys use the map's format: `wikidata:Q491516` or `name:<normalizedName>`. Reuse `normalizedName` from `mobile/src/features/map/mapRestaurants.ts`; do not write a second normaliser.
- Preselect when name score >= 0.8 and distance <= 300 m (nearest wins). Nearby fetch radius 500 m.
- Nominatim: one request per second, identifying User-Agent, results cached, search only on user action (debounced).
- Exactly one of `restaurantId` or `place` is required on a confirmed receipt.
- The agent never runs SQL against Supabase; the stopgap SQL is written for the user or Nathan to run.
- Contract (`shared/`) edits are shared with Nathan: keep the change additive and mention it in the PR.

## Review Focus

- Receipt name missing (`restaurantName` null): matcher returns no preselect and lists nearby by distance; screen falls to name search with an empty box.
- Location denied/unavailable: matcher gets no coordinate, never preselects from OSM, and the screen opens name search.
- Two same-brand branches within 300 m: nearest is preselected, the other stays in the list.
- Name variants ("McDonald's" vs "Mcdonalds", "CHICK-FIL-A #1234"): still score >= 0.8 (store numbers/`#` tokens must not drop the score).
- Nominatim returns zero/odd results (no coordinates, non-restaurant): mapped to nothing, screen shows "No matches", submit stays disabled.
- Both `restaurantId` and `place` set, or neither: contract rejects.

## File Structure

- Modify `shared/contracts.ts`, `shared/contracts.test.ts`: `placeSchema`, xor on `confirmedReceiptSchema`.
- Modify `mobile/src/features/receipts/receipt-api.ts`: relax the uuid check to only the id that is present.
- Create `mobile/src/features/receipts/match-place.ts`: pure matcher + `brandKeyFor`.
- Create `mobile/src/features/receipts/place-search.ts`: Nominatim URL, result mapping, cache, throttle.
- Create `mobile/src/features/receipts/place-choice.ts`: converts a candidate to the submit `place` and the unlock params to a candidate.
- Modify `mobile/app/(tabs)/scan.tsx`, `mobile/app/receipt/confirm.tsx`: forward unlock params, picker UI, submit payload.
- Create `supabase/stopgap-chick-fil-a.sql`.
- Tests in `mobile/tests/` (`receipt-match-place.test.ts`, `receipt-place-search.test.ts`, `receipt-place-choice.test.ts`) and `shared/contracts.test.ts`.

---

### Task 1: Contract — `place` on the confirmed receipt

**Files:**
- Modify: `shared/contracts.ts:68-78`
- Modify: `mobile/src/features/receipts/receipt-api.ts:150-174`
- Test: `shared/contracts.test.ts`, `mobile/tests/receipt-api.test.ts`

**Interfaces:**
- Produces: `placeSchema`, `type Place`, and `ConfirmedReceipt` where `restaurantId?: string` and `place?: Place`, exactly one present.

- [ ] **Step 1: Failing tests** in `shared/contracts.test.ts` (import `confirmedReceiptSchema`):

```ts
describe('confirmed receipt place', () => {
  const base = { draftId: 'd', submissionId: 's', receiptDate: '2026-10-11', receiptNumber: null, totalMinor: 1000, currency: 'USD', items: [{ originalText: 'x', confirmedName: 'x', quantity: 1 }] };
  const place = { osmType: 'node', osmId: 42, name: 'Chick-fil-A', brandKey: 'name:chick fil a', cuisine: 'chicken', latitude: 33.7, longitude: -84.4 };
  it('accepts a restaurantId or a place', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, restaurantId: 'r1' }).success).toBe(true);
    expect(confirmedReceiptSchema.safeParse({ ...base, place }).success).toBe(true);
  });
  it('rejects both or neither', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, restaurantId: 'r1', place }).success).toBe(false);
    expect(confirmedReceiptSchema.safeParse(base).success).toBe(false);
  });
  it('rejects out-of-range coordinates', () => {
    expect(confirmedReceiptSchema.safeParse({ ...base, place: { ...place, latitude: 91 } }).success).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run shared/contracts.test.ts` → FAIL.
- [ ] **Step 3: Implement** in `shared/contracts.ts`:

```ts
export const placeSchema = z.object({
  osmType: z.enum(['node', 'way', 'relation']),
  osmId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  address: z.string().max(300).optional(),
  brandKey: z.string().max(200).optional(),
  cuisine: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof placeSchema>;

export const confirmedReceiptSchema = z.object({
  draftId: z.string().min(1),
  submissionId: z.string().min(1),
  restaurantId: z.string().min(1).optional(),
  place: placeSchema.optional(),
  receiptDate: calendarDate,
  receiptNumber: z.string().nullable(),
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(receiptItemConfirmedSchema).min(1),
}).refine((value) => (value.restaurantId === undefined) !== (value.place === undefined), { message: 'Send exactly one of restaurantId or place.' });
```

- [ ] **Step 4:** In `receipt-api.ts` replace `&& uuidPattern.test(details.restaurantId ?? '')` with `&& (details.restaurantId === undefined || uuidPattern.test(details.restaurantId))`. Add a test in `mobile/tests/receipt-api.test.ts` (copy the existing submit test's setup) that a payload with `place` and no `restaurantId` POSTs successfully, and that an invalid `restaurantId` still throws `INVALID_RECEIPT`.
- [ ] **Step 5:** `npm test` → PASS (also `npx tsc --noEmit -p mobile` for any `ConfirmedReceipt.restaurantId` users).
- [ ] **Step 6: Commit** `feat(shared): confirmed receipt accepts a place instead of a restaurantId`

---

### Task 2: Matcher `matchReceiptToPlace`

**Files:**
- Create: `mobile/src/features/receipts/match-place.ts`
- Test: `mobile/tests/receipt-match-place.test.ts`

**Interfaces:**
- Consumes: `normalizedName` (`map/mapRestaurants.ts`), `distanceKm`, `Coordinate` (`map/coordinates.ts`), `OsmPlace` (`map/osm.ts`).
- Produces:

```ts
export type Candidate =
  | { kind: 'seeded'; restaurantId: string; name: string; brandKey: string; coordinate: Coordinate | null }
  | { kind: 'osm'; place: OsmPlace; name: string; brandKey: string; coordinate: Coordinate };
export type RankedCandidate = { candidate: Candidate; nameScore: number; distanceM: number | null };
export function brandKeyFor(place: Pick<OsmPlace, 'name' | 'brand' | 'brandWikidata'>): string;
export function matchReceiptToPlace(input: {
  receiptName: string | null | undefined; user: Coordinate | null; nearby: OsmPlace[];
  seeded: { id: string; name: string; coordinate: Coordinate | null }[];
}): { preselected: RankedCandidate | null; candidates: RankedCandidate[] };
```

- [ ] **Step 1: Failing tests:**

```ts
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
```

- [ ] **Step 2:** `npx vitest run mobile/tests/receipt-match-place.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Scoring: tokenise `normalizedName(x)` and drop tokens that are all digits or empty (store numbers; the `#` is already stripped by normalisation). Score 1 if the token strings are equal or `brandKeyFor` equals the other's brand key; 0.8 if every token of the shorter set is in the longer set; else `shared / max(sizeA, sizeB)` (0 if either set empty or no receipt name). Distance = `distanceKm(user, c.coordinate) * 1000`, `null` when user or coordinate is missing. Preselect = candidate with score >= 0.8 and (`distanceM !== null && distanceM <= 300`, or seeded with no coordinate/no user), lowest distance first (null last). `candidates` sorted by score desc then distance asc (null last); with no receipt name all scores are 0 so it is distance order. Seeded candidates use `brandKey: name:${normalizedName(name)}`.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5: Commit** `feat: match a receipt to nearby places by name and distance`

---

### Task 3: Name search (Nominatim)

**Files:**
- Create: `mobile/src/features/receipts/place-search.ts`
- Test: `mobile/tests/receipt-place-search.test.ts`

**Interfaces:**
- Consumes: `OsmPlace` type.
- Produces:

```ts
export function nominatimUrl(query: string, near: Coordinate | null): string;
export function mapNominatim(response: unknown): OsmPlace[];
export function createPlaceSearch(fetcher?: typeof fetch, now?: () => number, wait?: (ms: number) => Promise<void>): (query: string, near: Coordinate | null, signal?: AbortSignal) => Promise<OsmPlace[]>;
```

- [ ] **Step 1: Failing tests:**

```ts
it('builds a jsonv2 URL biased to the user area', () => {
  const url = new URL(nominatimUrl('Chick-fil-A', { latitude: 33.75, longitude: -84.39 }));
  expect(url.host).toBe('nominatim.openstreetmap.org');
  expect(url.searchParams.get('format')).toBe('jsonv2');
  expect(url.searchParams.get('q')).toBe('Chick-fil-A');
  expect(url.searchParams.get('viewbox')).toBeTruthy();
});
it('maps results to OsmPlace and drops rows without coordinates or osm ids', () => {
  const places = mapNominatim([
    { osm_type: 'node', osm_id: 7, name: 'Chick-fil-A', display_name: 'Chick-fil-A, 1 Main St, Atlanta', lat: '33.7', lon: '-84.4', category: 'amenity', type: 'fast_food' },
    { osm_type: 'node', osm_id: 8, name: 'Bad', lat: 'x', lon: '1' },
    { name: 'No id', lat: '1', lon: '1' },
  ]);
  expect(places).toHaveLength(1);
  expect(places[0]).toMatchObject({ osmType: 'node', osmId: 7, key: 'osm:node/7', coordinate: { latitude: 33.7, longitude: -84.4 } });
});
it('returns [] for non-array responses', () => { expect(mapNominatim({})).toEqual([]); });
it('caches by normalised query and spaces requests one second apart', async () => {
  const fetcher = vi.fn(async () => new Response('[]'));
  let t = 0; const waits: number[] = [];
  const search = createPlaceSearch(fetcher as never, () => t, async (ms) => { waits.push(ms); t += ms; });
  await search('Chick-fil-A', null); await search(' chick-fil-a ', null); await search('Other', null);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(waits).toEqual([1000]);
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** URL: `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=...`; with `near`, add `viewbox` (±0.5°) and `bounded=0`. Headers: `{ 'User-Agent': 'FoodieCards/1.0 (jamesafon4@gmail.com)', Accept: 'application/json' }` — **confirm the contact address with the user in the PR**. Map: require `osm_type` in node/way/relation, numeric `osm_id`, finite `parseFloat(lat/lon)`, name = `name` else first segment of `display_name`; `amenity` = `type` when `category === 'amenity'` else `'restaurant'`; `cuisine: null`; `address` from `address.house_number + road` when present; `brand: null`, `brandWikidata: null`. Cache: `Map<normalizedName(query), OsmPlace[]>`; before a network call wait `max(0, 1000 - (now() - lastAt))`. Non-OK response throws `Error('Place search is unavailable right now.')`.
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Commit** `feat: search places by name with Nominatim (cached, 1 req/s)`

---

### Task 4: Choice → submit payload, unlock params → candidate

**Files:**
- Create: `mobile/src/features/receipts/place-choice.ts`
- Test: `mobile/tests/receipt-place-choice.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `brandKeyFor` (Task 2), `Place` (Task 1), `UnlockTarget`.
- Produces:

```ts
export function submitTargetFor(candidate: Candidate): { restaurantId: string } | { place: Place };
export function unlockCandidate(target: UnlockTarget, nearby: OsmPlace[], seeded: { id: string; name: string }[]): Candidate | null;
```

- [ ] **Step 1: Failing tests:** a seeded candidate → `{ restaurantId }`; an OSM candidate → `{ place }` with `latitude/longitude` from the place (not the user), `brandKey` from `brandKeyFor`, `address` joined from address + city when present, `cuisine` omitted when null (assert `not.toHaveProperty('cuisine')`); `unlockCandidate` with `restaurantId` finds the seeded row, with `osm: 'node/42'` finds the matching nearby place, returns `null` when neither resolves.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement exactly to those tests. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: turn a chosen place into the receipt submit payload`

---

### Task 5: Screens — forward the unlock place, picker UI, submit

**Files:**
- Modify: `mobile/app/(tabs)/scan.tsx:101` (push params)
- Modify: `mobile/app/receipt/confirm.tsx` (load nearby, picker, submit)

**Interfaces:** Consumes Tasks 2–4, `parseUnlockParams`, `useUserLocation`, and the map's nearby source (`mobile/src/features/map/nearbySource.ts` — read it first and reuse its fetch/cache entry point; do not write a second Overpass client).

- [ ] **Step 1:** In `scan.tsx` push `params: { draftId: draft.draftId, ...unlockParamsFromRoute }` so confirm receives the same `unlock*` params Scan got; parse in confirm with `parseUnlockParams`.
- [ ] **Step 2:** In `confirm.tsx` after the draft loads: get the user's coordinate (null if denied, never block), get nearby places (map cache else one fresh 500 m fetch; failure → `[]`), build `seeded` from `restaurants` + `coordinateFor`. Try `unlockCandidate` first; else `matchReceiptToPlace`. Add `chosen: Candidate | null` state; a seeded choice also sets `restaurantId`.
- [ ] **Step 3:** Replace the radio list with a card "We think you ate at **{name}** · {distance} mi" with **Confirm**; **Choose another** expands `candidates` (nearby then seeded five); **Search by name** shows a text field (initial value the receipt's `restaurantName`) and a Search button using `createPlaceSearch` (user-initiated only, no per-keystroke fetch); results append as `osm` candidates. No preselect or location denied → name search open. Empty results → "No matches. Try a different spelling."
- [ ] **Step 4:** In `submit()` spread `submitTargetFor(chosen)` into the `submitReceipt` payload; the validation message becomes "Choose the restaurant you ate at." when `chosen` is null. Never send the user's coordinate.
- [ ] **Step 5:** `npm test && npx tsc --noEmit -p mobile` → PASS. Run the app (`run` skill) and walk the receipt flow with location allowed and denied.
- [ ] **Step 6: Commit** `feat: pick the restaurant from a matched place on the confirm screen`

---

### Task 6: Map lines up (piece 4)

**Files:**
- Modify: `mobile/src/features/map/mapRestaurants.ts:47`
- Test: `mobile/tests/map-data.test.ts`

- [ ] **Step 1: Failing test:** a catalog place with `brandKey: 'wikidata:Q1'` plus `latitude/longitude` yields a pin with that `brandKey` and its own coordinate; without `brandKey` it still gets `name:<normalised>`.
- [ ] **Step 2:** run → FAIL. **Step 3:** extend `Place` with `brandKey?: string | null`; use ``place.brandKey ?? `name:${normalizedName(place.name)}` ``. (Inert until the API returns it; that is Nathan's side.)
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(map): use a restaurant's stored brand key when present`

---

### Task 7: Demo stopgap SQL (piece 0)

**Files:**
- Create: `supabase/stopgap-chick-fil-a.sql` (shape of `supabase/seed.sql`; **never run by the agent**)

- [ ] **Step 1:** Write `insert into public.restaurants (id, slug, name, location_label, category, aliases, theme) values ('10000000-0000-4000-8000-000000000006', 'chick-fil-a-atlanta', 'Chick-fil-A', 'Atlanta', 'chicken', array['Chick-fil-A','Chick fil A','CFA'], '<neutral theme json>'::jsonb) on conflict (slug) do update set ...` and `menu_items` with ids `20000000-0000-4000-8000-0000000000NN` and aliases for common lines (chicken sandwich, spicy chicken sandwich, nuggets, waffle fries, lemonade, sweet tea, milkshake). Category `chicken` only; nothing brand-specific in art.
- [ ] **Step 2:** Header comment: throwaway, run in the Supabase SQL editor by the user or Nathan, removed once the place-based backend lands. Add coordinates to `RESTAURANT_COORDINATES` only if the user gives the branch address.
- [ ] **Step 3: Commit** `chore: add throwaway Chick-fil-A seed for the demo`

---

## Self-review

- Spec coverage: pieces 0 (T7), 1 (T1), 3 (T2–T5), 4 (T6). Piece 2 and the server test list are Nathan's and intentionally not here.
- Open from the spec's Risks: dish-credit XP rule, migration order, who runs SQL.
- Names consistent across tasks: `Candidate`, `RankedCandidate`, `brandKeyFor`, `matchReceiptToPlace`, `submitTargetFor`, `unlockCandidate`, `createPlaceSearch`.
