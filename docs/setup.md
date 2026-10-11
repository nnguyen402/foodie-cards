# Foodie Cards setup

Foodie Cards uses Supabase for email/password accounts, application data, and private receipt images. Gemini and the Supabase service role key stay on the backend. The phone uses only the Supabase publishable key.

## Environment variables

Set these in the matching app environment. Do not commit `.env` files or real keys.

| Where | Variable | Value |
|---|---|---|
| Mobile | `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL, for example `https://<project-ref>.supabase.co` |
| Mobile | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key from the project API settings |
| Mobile | `EXPO_PUBLIC_API_URL` | Public base URL for the Express backend, with no trailing slash |
| Server | `SUPABASE_URL` | The same Supabase project URL |
| Server | `SUPABASE_SERVICE_ROLE_KEY` | The project service-role key; keep it in backend secrets only |
| Server | `GEMINI_API_KEY` | Gemini API key; keep it in backend secrets only |
| Server | `GEMINI_MODEL` | The image-capable Gemini model selected for the project |

For local phone development, `EXPO_PUBLIC_API_URL` must use the development computer's LAN address and the backend port, such as `http://192.168.1.20:3000`. A phone cannot reach the development computer through `localhost`. Both devices need network access to that address. For a device using Expo Go against a hosted backend, use the deployed HTTPS backend URL instead.

## Supabase project and schema

Create a Supabase project and set up its Auth email/password provider. Credentials are kept in ignored local files; the configured hosted project and verification status are recorded in the checkpoint handoff. The initial migration creates the private tables, Row Level Security policies, the `receipts` private Storage bucket, and signup profile trigger. `supabase/seed.sql` adds five curated Atlanta locations and a small menu catalog; menu entries are examples for matching, not live menu or price data. No receipt history, reviews, or XP are seeded.

Install the Supabase CLI using the official install method for your development machine. To reproduce the database locally, run a Docker-compatible container runtime, then from the repository root:

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase status
```

`db reset` recreates the local database, applies migrations, then runs `seed.sql`. `test db` runs the SQL pgTAP security tests against that database. This requires Docker Desktop (or another Docker-compatible runtime) running. Use `npx supabase stop` when done.

Local verification on October 10, 2026: `npx supabase start` and a clean `npx supabase db reset` applied the migration and seed successfully, and `npx supabase test db` passed all 19 checks in `supabase/tests/foundation_security.test.sql`. The local stack is currently running for integration QA.

To apply the committed migration and catalog to a new hosted project, sign in with the Supabase CLI and link the project:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
```

The linked operation applies local migrations and the configured seed file to that project. Keep the database password and access tokens out of the repository. The SQL tests are written for the local Supabase database; do not run the test suite against production user data.

Each auth signup inserts a private `profiles` row with `display_name = 'Foodie'`, `account_xp = 0`, and a bundled `avatar_key` (default `fork`). The mobile builder should use `profiles.id` as the signed-in user ID and derive `accountLevel = 1 + floor(accountXP / 200)`. The table uses snake_case fields: `account_xp`, `equipped_title_key`, `display_name`, `avatar_key`. Clients can edit only display name and avatar. The foundation migration does not contain reward RPCs; subsequent Lane A migrations add receipt acceptance, review awards, and profile/title actions. See the Lane A handoff for endpoint contracts and rollout status.

Receipt storage paths must start with the owning user's UUID, for example `<user-uuid>/<receipt-id>.jpg`. The bucket is private and Storage policies check that first folder against `auth.uid()`. Do not put receipt images, totals, receipt numbers, or paths into public profile views.

## Mobile development and iPhone QA

Install the root workspace dependencies using the repository's package manager, then start Expo using the script documented in the root `package.json` (currently owned by the foundation scaffold). Open its QR code with Expo Go on the demo iPhone. The phone and development computer need to share a network that allows local device traffic. Configure the Supabase URL/key and LAN-accessible API URL in the mobile environment before launching.

Physical-phone verification is still outstanding: test email/password signup, session persistence after closing and reopening Expo Go, sign-out, account switching without stale collection data, and a request to the backend health endpoint. Expo Go availability and installation rules can differ by iOS version and account. If Expo Go cannot install or reach the app, use the team's configured development build path and record the actual result; do not treat simulator checks as phone verification.

## Backend access and deployment

Run the existing Express backend with `npm run server`. For the iPhone demo on the same network, set `EXPO_PUBLIC_API_URL` to the computer's reachable LAN address and port. Replit is excluded from this project workflow. If a public demo endpoint is needed later, deploy this same backend to the team's chosen Node.js host and use its HTTPS URL. Keep `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` server-side. Apply schema changes through committed Supabase migrations, not dashboard-only table edits. Confirm backend health from the phone; a local process is not a public deployment.

The hosted Supabase foundation and ignored local environment files are configured; see the checkpoint handoff for verification. Remaining live checks include Auth email/redirect behavior, current feature migration rollout, phone/backend connectivity, and the physical iPhone smoke test. Public backend deployment is a separate optional hosting decision; do not create a Replit project.

## Curated catalog sources

Restaurant names, primary locations, and representative dish names were checked against restaurant-published pages on October 10, 2026. The seed intentionally stores no photos or prices. The menu rows remain a small matching catalog, not a promise that an item or location is available on a future visit.

- [Busy Bee locations](https://www.thebusybeecafe.com/locations)
- [Fox Bros locations and menu](https://www.foxbrosbbq.com/dekalb-ave)
- [Mary Mac’s directions](https://marymacs.com/hours-and-directions/) and [menu](https://marymacs.com/menu/)
- [The Varsity Atlanta](https://thevarsity.com/pages/the-varsity-atlanta)
- [Antico Pizza](https://www.anticofinefood.com/pizza)
