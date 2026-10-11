# Place-based restaurant matching for receipts

Status: draft for review. Owner of the app side: Lane C. Owner of the backend side: Nathan (shared contract, migrations, server).

## Goal

Scanning a receipt picks the restaurant automatically, from the name on the receipt and where the user is, instead of the five seeded restaurants. A restaurant we have never seen (Chick-fil-A) is created on first accepted receipt and gets a card. Success: the Chick-fil-A receipt preselects it, submits, and the card shows on the map and in the collection; a second visit anywhere in that chain adds to the same card.

## Decisions (made with the user)

1. **Approach A: the place travels with the submit.** Submit accepts `restaurantId` (today) or a `place`. One database step finds or creates the restaurant, builds its menu items and accepts the receipt. Nothing is created if the user abandons the scan.
2. **One card per brand.** A chain is one restaurant row keyed by brand. Independent restaurants are one row per OSM place. This matches the `brandKey` already on map pins.
3. **No nearby match falls back to search by name**, not to the seeded list and not to free typing.
4. Location handling: the exact user coordinate is used by the existing nearby map lookup, which may send it to a public Overpass server; Nominatim search receives a 0.1° rounded area bias. The app backend receives only the chosen place's coordinates, never the user's coordinate. Art stays keyed by cuisine only (never by brand or restaurant name).

## Pieces and owners

| # | Piece | Owner | Size |
|---|-------|-------|------|
| 0 | Demo stopgap: seed Chick-fil-A (restaurant, aliases, starter menu) with SQL | Lane C writes, user or Nathan runs | S |
| 1 | Contract: `place` on the confirmed receipt | Nathan (shared), Lane C drafts | S |
| 2 | Backend: migration, resolve function, menu fallback, guard rails | Nathan | M |
| 3 | App: matching, "We think you ate at..." picker, name search | Lane C | M |
| 4 | Map and cards line up (brand key, coordinates from the row) | Lane C | S |

## 0. Demo stopgap

Until pieces 1 and 2 exist, a Chick-fil-A receipt can only work if Chick-fil-A is a seeded restaurant. The stopgap is one SQL script, written by Lane C and run in the Supabase SQL editor by the user or Nathan (never run by the agent): an `insert ... on conflict (slug) do update` into `restaurants` (name, slug, location label, category `chicken`, aliases such as "Chick-fil-A" and "CFA") and a starter set of `menu_items` with aliases for common receipt lines. It follows the shape of `supabase/seed.sql`, so the receipt reader's existing name matching preselects it with no app change. It is throwaway: once piece 2 lands, the restaurant is found by its brand key and the seeded rows become ordinary `catalog` rows. The mobile side needs its coordinates only if the map should show it, which piece 4 covers.

## 1. Contract (shared)

The confirmed receipt gains an optional `place`; exactly one of `restaurantId` or `place` is required.

```
place: {
  osmType: 'node' | 'way' | 'relation',
  osmId: number,
  name: string,            // as OSM names it
  address?: string,
  brandKey?: string,       // 'wikidata:Q491516' or 'name:chick fil a' (same format as map pins)
  cuisine?: string,        // OSM cuisine tag, first value
  latitude: number,        // the place's, never the user's
  longitude: number
}
```

The draft already carries `restaurantName`; matching uses it.

## 2. Backend

**Migration** (new file; not an edit of existing ones):
- `restaurants` gains `source text not null default 'catalog' check (source in ('catalog','osm'))`, `osm_type`, `osm_id bigint`, `brand_key text`, `brand_wikidata text`, `latitude double precision`, `longitude double precision`, `created_by uuid`.
- Unique on `(osm_type, osm_id)` where not null, and on `brand_key` where not null (one row per brand).
- Backfill `brand_key` for the five seeded restaurants as `name:<normalised name>`.

**Resolve** (security-definer function, service role only): given a place, return the existing restaurant by `brand_key`, else by OSM id, else create one: slug from the name plus OSM id, `location_label` from the address or "Nearby", `category` from the cuisine or "restaurant", `theme` null (the app draws a neutral theme), `source = 'osm'`, `created_by` set.

**Guard rails:** the receipt's detected restaurant name must fuzzy-match `place.name` or its brand name; at most 5 newly created restaurants per user per 24 hours; the place's coordinates are stored for display only.

**Menu fallback:** `user_items.menu_item_id` is `not null`, so for `source = 'osm'` restaurants the server inserts `menu_items` from the confirmed lines (`canonical_name` = normalised confirmed name, unique per restaurant) before acceptance, instead of rejecting unmatched lines. Seeded restaurants keep strict matching.

**Server:** `POST /api/receipts/submit` branches on `place`: guard, resolve, ensure menu items, then the existing accept path. Errors reuse existing codes (`UNSUPPORTED_RESTAURANT` becomes `INVALID_RECEIPT` with a clear message when the name does not match).

## 3. App

**Matching** (`matchReceiptToPlace`, a pure function, fully unit tested). Inputs: the receipt's restaurant name, the user's coordinate (optional), nearby places (the map's cached OSM places, else one fresh fetch within 500 m), and the seeded restaurants.
- Name score: 1.0 for equal normalised name or equal brand; 0.8 when one name's words contain the other's; otherwise word overlap.
- Preselect when the name score is at least 0.8 and the place is within 300 m; if several, the nearest. Otherwise list candidates by name score then distance.
- Normalisation reuses the existing `normalizedName`, and brand keys reuse the map's format, so "McDonald's" and "Mcdonalds" match.

**Confirm screen:** a card reading "We think you ate at **Chick-fil-A** · 0.1 mi" with Confirm; **Choose another** opens the nearby places and the seeded five; **Search by name** looks up the receipt's name (OpenStreetMap Nominatim, one request per second, identifying User-Agent, results cached, debounced). Location denied or no match goes straight to name search. The app sends only the chosen place.

**Unlock button:** the Scan screen already receives the place from the map; the confirm screen preselects it.

## 4. Map and cards

Restaurants created from places show on the map from their own `latitude` and `longitude` (the existing `coordinateFor` already prefers stored coordinates). Art picks up the new restaurant's cuisine through the existing generic-word detection; a restaurant with no clear cuisine shows the drawn icon.

## Testing

- Unit (Lane C): matching scores and thresholds, chain name variants, no match, location off, the search-result mapping, the submit payload shape.
- Server (Nathan): submit with `place` creates once and reuses afterwards, the brand reuses the same row across branches, name-mismatch is rejected, the daily cap, and the menu fallback; seeded restaurants behave as before.
- On device: the Chick-fil-A receipt preselects, submits, shows the card on the map and in the collection, and a second visit increases the visit count.

## Risks and open details

- Dish credit: auto-created menu items change how "dishes tried" counts toward XP; Nathan to confirm the rule.
- Nominatim's usage policy limits search volume; name search must stay user-initiated and cached.
- A restaurant created from a place has no curated theme or hero image; the neutral look is expected.
- Migration order and who runs it in Supabase (Nathan).

## Out of scope

Per-branch cards, curated menus for created restaurants, editing or merging duplicate restaurants, any change to ratings, and server-side access to the user's location.
