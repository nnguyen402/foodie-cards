# PR 6 and 7 integration

PR 7 includes all commits from PR 6. The integration adds the backend place-submission path that both PRs required, plus place coordinates and brand identity in card queries. Confirmed menu items for new OSM restaurants are resolved in the same database transaction as receipt acceptance. Catalog restaurants keep their existing menu validation.

## Deployment order

Apply supabase/migrations/20261011000400_place_restaurants.sql to the Supabase project before restarting the updated server and loading the updated mobile app. The mobile restaurant queries require the new columns. This migration was applied and tested on the local database; pushing Git commits does not apply it to a hosted Supabase project. The optional stopgap Chick-fil-A scripts are not required for the new place path.

## Verification

The integrated changes are checked with the complete Vitest suite, shared/server/mobile TypeScript checks, all SQL test suites against local PostgreSQL, and Expo exports for web and iOS. SQL regressions cover new-place creation, generated menu items, exact replay, chain reuse, name mismatch, rollback, daily cap, and service-role RPC access. This does not replace a final physical iPhone receipt-to-card smoke test against the deployed project.
