# Foodie Cards

A mobile dining journal where confirmed receipts unlock and evolve personal restaurant cards.

## Project status

Planning baseline for the Hacklanta team. Application implementation has not started.

- [Full build plan and product rules](docs/foodie-cards-plan.md)
- [Team ownership and integration workflow](docs/team-workflow.md)

## Planned architecture

- Expo / React Native / TypeScript mobile app with Expo Router.
- TypeScript / Express backend hosted on Replit, calling Gemini for receipt extraction.
- Supabase exclusively for authentication, PostgreSQL application data, and private receipt storage.
- Shared Zod / TypeScript contracts and committed database migrations.

## First milestone

Have one coordinating Codex agent complete Task 1 plus shared interfaces and labeled development fixtures: a runnable scaffold, authenticated profile, Supabase setup, backend connectivity, and a verified physical-phone baseline. Extend an existing Replit scaffold if available, or create the foundation in this repository with Replit backend hosting.

Then hand off substantial receipt/AI, cards/visuals, and profile/sharing work to teammates and their agents. The foundation owner continues transactional progression and integration. Section 5 of the build plan defines ownership, subagent boundaries, and integration checkpoints.

The live receipt-to-first-card flow takes priority. Rewards must be transactional and idempotent; receipts stay private; development fixtures must be clearly labeled.

Never commit credentials, environment files, or real receipt images. Required environment-variable names are documented in the build plan.
