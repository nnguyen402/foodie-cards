# Cuisine art

Optional illustrations for restaurant cards and map tokens. Drop a file in this folder, then
add it to `ART` in `src/features/cards/cuisineArt.ts`. Anything without a file keeps the
code-drawn icon, so the folder can fill in one cuisine at a time.

Expected files (PNG, 512×512, transparent background, under 200 KB each):

- `burger.png`
- `pizza.png`
- `asian.png`
- `mexican.png`
- `bbq.png`
- `chicken.png`
- `coffee.png`
- `dessert.png`
- `breakfast.png`
- `southern.png`
- `seafood.png`
- `default.png`

Metro bundles whatever `require()` points at, and a `require()` of a missing file breaks the
build, so only list files that are committed here.
