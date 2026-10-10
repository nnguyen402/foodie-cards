# Foundation handoff

This milestone implements Task 1 of [the build plan](foodie-cards-plan.md). It establishes accounts, private data boundaries, shared contracts, mobile route shells, and backend connectivity. Receipt extraction, acceptance, progression, card reveals, review awards, and public sharing belong to later tasks.

## Ownership

| Lane | Files | Contract |
|---|---|---|
| A: integrator | Root packages/lockfile, `shared/`, `supabase/`, server auth and award transactions | Approves shared interface, schema, and dependency changes. |
| B: receipts/AI | `server/src/receipts/`, `mobile/src/features/receipts/`, receipt confirmation | Produces a validated draft; submits confirmation to A's acceptance API. |
| C: cards | `mobile/src/features/cards/`, collection/detail/reveal routes and prepared assets | Presents persisted rewards; acknowledges completed or skipped reveal events. |
| D: profile/sharing | Profile UI, review UI/routes, public preview pages | Calls A's review award transaction; never calculates rewards independently. |

Assign exact files before parallel edits. Keep independent work on lane branches. Coordinate changes to shared contracts and migrations through A. Do not edit another lane's route while they are working in it.

## Shared interfaces

`shared/contracts.ts` is the source of truth for Zod schemas and TypeScript types. The build plan fixes receipt draft/confirmation, progression, theme, and API error shapes. Foundation also defines profile edits, owned pins, title equipment, reviews, and reveal acknowledgement. Those contracts do not imply that every later endpoint is implemented.

Profiles use camelCase at the API boundary and snake_case in PostgreSQL. Account level is derived from account XP. Receipt date is the restaurant's printed local `YYYY-MM-DD`, not a UTC timestamp. Zero stars is a rating; null is unrated. The authenticated token determines ownership, never a user ID supplied in a request.

Development fixtures are explicitly labeled synthetic. They support lane development and contract tests; they never create live cards, visits, XP, or rewards. Keep real receipt images outside Git.

## Verification before team demo

Run the commands in [setup](setup.md), then validate on the chosen physical phone against configured Supabase and a reachable backend:

1. Create an account, confirm email if enabled, and sign in.
2. Relaunch and confirm session persistence and profile loading.
3. Confirm collection starts empty and backend health can be checked.
4. Sign out; sign in as another user and verify no previous user's data appears.
5. Execute the database access checks with two test accounts. Confirm neither can read the other's private rows or receipt files, or write protected reward columns.

Local type checking, HTTP tests, schema checks, and Expo checks cannot substitute for a phone test or real Supabase access checks. Record unavailable checks explicitly. The team must finish this gate before treating the foundation as a verified phone baseline.
