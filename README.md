# Foodie Cards

A mobile dining journal where confirmed receipts unlock and evolve personal restaurant cards.

## Project status

The foundation code checkpoint includes Expo mobile authentication and native tab shells, an Express backend, shared validated contracts, and a Supabase schema with private storage and access rules. Real iPhone authentication checks remain pending. Receipt extraction and reward progression are the next milestone. This baseline does not award fixture progress.

- [Product requirements document — start here](docs/PRD.md)
- [Full build plan and product rules](docs/foodie-cards-plan.md)
- [Team ownership and integration workflow](docs/team-workflow.md)
- [Local setup, Supabase configuration, and iPhone checks](docs/setup.md)
- [Foundation interfaces and lane handoff](docs/foundation-handoff.md)
- [Checkpoint status and next-agent handoff](docs/checkpoint-handoff.md)

## Planned architecture

- Expo / React Native / TypeScript mobile app with Expo Router.
- TypeScript / Express backend hosted on Replit, calling Gemini for receipt extraction.
- Supabase exclusively for authentication, PostgreSQL application data, and private receipt storage.
- Shared Zod / TypeScript contracts and committed database migrations.

## First milestone

Task 1 supplies shared interfaces and labeled development fixtures, authentication and profile handling, Supabase migrations, backend connectivity, and mobile shells. Hosted Supabase configuration and a physical iPhone smoke test are required before calling this a verified phone baseline.

Then hand off substantial receipt/AI, cards/visuals, and profile/sharing work to teammates and their agents. The foundation owner continues transactional progression and integration. Section 5 of the build plan defines ownership, subagent boundaries, and integration checkpoints.

The live receipt-to-first-card flow takes priority. Rewards must be transactional and idempotent; receipts stay private; development fixtures must be clearly labeled.

## Local development

Use Node.js LTS supported by the selected Expo SDK. From the repository root:

```powershell
npm install
npm run server
```

In a second terminal, run `npm run mobile` and open the QR code with Expo Go on the iPhone. Configure the example environment files using [setup](docs/setup.md); the phone needs a reachable backend URL. `GET /health` works without Supabase credentials, while authenticated data requires a configured project.

Run `npm test`, `npm run typecheck`, and `npm run build` for local verification. Database security checks require the local Supabase stack: `npx supabase start`, `npx supabase db reset`, then `npx supabase test db`. Keep the local test database separate from hosted user data.

Never commit credentials, environment files, or real receipt images. Required environment-variable names are documented in the build plan.
