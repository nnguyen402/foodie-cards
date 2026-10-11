# PR 6 and 7 integration

PR 7 includes all commits from PR 6. The integration adds the backend place-submission path that both PRs required, plus place coordinates and brand identity in card queries. Confirmed menu items for new OSM restaurants are resolved in the same database transaction as receipt acceptance. Catalog restaurants keep their existing menu validation.

## Deployment order

Apply supabase/migrations/20261011000400_place_restaurants.sql to the Supabase project before restarting the updated server and loading the updated mobile app. The mobile restaurant queries require the new columns. Migrations 20261011000400 and 20261011000500 were applied to the shared Supabase project on October 11, 2026. Other projects must apply both migrations; pushing Git commits does not deploy database changes. The optional stopgap Chick-fil-A scripts are not required for the new place path.

## Verification

The integrated changes are checked with the complete Vitest suite, shared/server/mobile TypeScript checks, all SQL test suites against local PostgreSQL, and Expo exports for web and iOS. SQL regressions cover new-place creation, generated menu items, exact replay, chain reuse, name mismatch, rollback, daily cap, and service-role RPC access. This does not replace a final physical iPhone receipt-to-card smoke test against the deployed project.

## Browser fixes verified October 11

One-decimal ratings (including 4.3) now save and persist after reload. Receipt names with a multi-word brand prefix can match listings with city or description suffixes, while unrelated single-word matches remain rejected. Resolved restaurant/date warnings disappear after correction. An In-N-Out receipt completed extraction, review, confirmation, and card creation in the browser against local Supabase; its missing date was filled with a QA date. All 446 Vitest tests, 195 SQL assertions, and TypeScript checks passed. Restaurants absent from OpenStreetMap still need a future manual-entry fallback.
