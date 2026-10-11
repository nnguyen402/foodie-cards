# Project checkpoint — 2026-10-10

## Integrated A/B/C checkpoint (October 11, 2026)

The progression, receipt scanning, and cards/map/reveal PRs are integrated together. Both receipt extraction and acceptance routes are registered; confirmation opens awarded reveals, and reveal labels consume the backend's ordered stage awards. Camera and location plugins are both retained. The sections below are historical lane checkpoints and do not describe the current integration state.

Verification includes the combined Vitest suite, shared/server/mobile typechecking, Expo Doctor, exports, 164 local SQL assertions, five concurrency probes, and the local Auth/PostgREST/HTTP probe. That HTTP probe now exercises multipart upload through real private storage and owned draft reload before acceptance; only its AI output is synthetic. Earlier receipt verification used three real photos with live Gemini.

Deployment still requires the committed receipt draft migration on the target database, phone-reachable backend configuration, and physical-phone QA. This integration does not deploy hosted changes. OpenStreetMap-only places remain browsing entries; they cannot create restaurant cards through the supported-catalog receipt API.

## Historical Lane A checkpoint

Work is on `feat/lane-a-progression`; push this branch only and open a PR to `main` later. The project owner owns A, one teammate owns B+C, and another owns D. Replit is excluded. Use the existing checkout and ignored credentials. The historical foundation notes below describe the earlier checkpoint; this section supersedes their pending-work statements.

Implemented in A: authenticated receipt submission, server-owned draft validation, canonical item resolution, atomic receipt/visit/item/card progression, global hash/fingerprint duplicate protection, persisted exact retry results, every crossed stage award, badge/title evaluation, transactional reviews, profile edits, atomic owned pins, unlocked title equipment, and pending/idempotently viewed reveal APIs. Incomplete extraction fields may be null only while a receipt is a draft. Earlier interrupted milestone reveals survive later evolution.

Verification: 57 JavaScript tests across eight files; root build/typecheck; all 159 SQL checks across four files; five real concurrent-session checks; real local Supabase Auth/PostgREST/HTTP integration for receipt ownership/scoring/replay, reviews, profile actions, and reveal recovery. Synthetic accounts/images are cleaned up. Independent final review found no remaining material findings. No mobile files or dependencies were changed, so prior Expo validation is historical rather than a new physical-device claim.

The new migrations are `20261010000200_foodie_cards_progression.sql` and `20261010000300_foodie_cards_profile_actions.sql`; both are applied to the local QA database and authorized hosted project, with migration history aligned. Hosted application used the exact reviewed files in one atomic transaction after verifying only the foundation migration existed and no non-draft legacy receipts required compatibility changes. Hosted history records 00100/00200/00300 with 76/13/9 statements. All six exposed RPCs deny anon/authenticated execution and permit service_role. No hosted users or Auth settings were changed; authenticated two-user hosted behavior still needs QA. Never reset hosted data.

Read [Lane A interfaces and integration instructions](lane-a-handoff.md) first. B+C should persist owned, hashed extraction drafts and call acceptance/reveal APIs. D should call A's review/profile APIs and own mobile presentation. Remaining gates: B's real Gemini extraction and confirmation integration, C/D mobile screens, physical iPhone auth/session/recovery/privacy QA, and a phone-reachable backend. Public hosting is optional until needed; do not create Replit.

Lane A ignored execution ledger and reports live in `.superpowers/sdd/2026-10-10-lane-a-progression/`. The [Lane A implementation plan](superpowers/plans/2026-10-10-lane-a-progression.md), PRD, shared contracts, committed SQL migrations, and tests are the authoritative references for fresh agents.

## Resume here

Use the existing checkout at `C:\Documents\Projects\foodie-cards`. Do not clone again or use `C:\Users\natha\foodie-cards`. The starting commit was `7856de3`; database foundation commit is `0bc85c4`, and mobile/API foundation checkpoint is `f7072aa`. This checkpoint stops at Task 1 of [the build plan](foodie-cards-plan.md); the physical iPhone gate is still pending. The user authorized merging and publishing the checkpoint to `main`; teammates should branch from the latest remote `main`. [Team workflow](team-workflow.md#assignments-to-start-now) contains the current assignments, deliverables, ownership boundaries, and dependencies.

The user requested a Luna agent orchestrator for build, test, and review, using Superpowers and the Expo animation, design-system, and native-UI skills. All shell commands must start with `rtk`, per `C:\Users\natha\.codex\RTK.md`. Assign disjoint files before parallel work and preserve existing changes.

## Implemented

- npm workspaces for `mobile/`, `server/`, and `shared/`, with a committed lockfile and test/typecheck scripts.
- Expo Router authentication and collection/scan/profile tab shells, Supabase session handling, profile loading, sign-out, reusable theme and UI components. The scan and collection screens do not simulate earned progress.
- Express health and authenticated profile APIs. Tokens determine ownership; public client configuration never includes the service-role key.
- Shared Zod contracts and explicitly synthetic fixtures for later receipt, progression, cards, reviews, and sharing work. Defined contracts do not mean later endpoints exist.
- Supabase schema, signup profile trigger, private receipt storage, ownership policies, protected reward columns, pin ownership/slot constraints, and five restaurant seeds. Atomic acceptance and award transactions remain future work.
- Setup instructions and environment examples. Local credential files are ignored by Git.

## Verification

The dedicated tester ran the current foundation code: 18 tests across four files passed; root typecheck and build passed; Expo export bundled web, iOS, and Android. Backend smoke checks returned health 200 and 401 for missing and forged Bearer tokens. Local Supabase passed all 19 pgTAP security checks, independently rerun by the integrator. Independent schema review found no critical or important issues.

These checks do not verify actual signup, email confirmation, persisted session restoration, account switching, or the physical iPhone experience. Auth helpers have unit coverage; the full auth provider and configuration screen lack integration coverage. Browser visual preview was denied by the saved permission setting and was not bypassed.

The integrator's final run passed 18 tests, root build/typecheck, all 21 Expo Doctor checks, and a fresh iOS export after dependency alignment and the error-display fixes. Reanimated is deduplicated to SDK-compatible 4.5.1 through a root dependency pin. Independent application review found two error-display bugs: failed signup showed confirmation instructions, and initial collection failure showed an indefinite loading screen. Both branches were corrected before this checkpoint; full provider/UI integration coverage remains pending.

npm audit currently reports 29 advisories (11 moderate, 18 high), including Expo toolchain transitive dependencies; compatible attempted overrides did not resolve them. Do not run a forced dependency downgrade without checking the Expo compatibility consequences.

## Supabase and local services

The authorized hosted project is `hacklanta_2`, ref `pceralaksbvhilxxyjbs`, region `us-east-1`. The user supplied a scoped personal access token locally. `server/.env` contains the server URL and service-role key; `mobile/.env` contains the public URL/key and development backend address. `.env.supabase.local` holds the setup token and project ref. Never print or commit these values. The user has populated GEMINI_MODEL and GEMINI_API_KEY in ignored server/.env; presence was verified without printing values. API connectivity and model access remain unverified.

Hosted setup completed: the committed migration was applied atomically through the authorized Management API query endpoint, recording exact CLI-compatible version `20261010000100`, name `foodie_cards_foundation`, and 76 parsed statements. The four seed statements were applied without a seed migration row. The setup agent verified 15 application tables with RLS, 18 policies, catalog counts of 5 restaurants/15 menu items/8 badges/8 titles, and a private receipts bucket. Anonymous catalog REST returned 200; anonymous profiles/receipts REST returned 401. Migration metadata is inaccessible to anon/authenticated. Storage has four authenticated owner-folder policies and no anonymous policies; its ACL includes inherited SELECT, so privacy depends on RLS and the private bucket. Real authenticated two-user hosted tests remain pending. No hosted users or auth settings were changed.

The local Supabase stack and Docker were left running for QA. The integrator's Metro preview and tester's temporary backend were stopped. Start the backend with `npm run server` and Metro with `npm run mobile`; confirm the phone's backend URL matches the current computer LAN address. Replit is excluded from this workflow; no public backend deployment exists yet.

## Next required work

1. Complete the real iPhone gate in [foundation-handoff](foundation-handoff.md): signup/confirmation/sign-in, relaunch/session/profile, empty collection, backend health, sign-out/account switch, and private-data checks. Record failures and fix them before calling Task 1 a verified phone baseline.
2. Review [setup](setup.md) and the hosted setup result below. Keep migration history aligned with local version `20261010000100`; never reset the hosted database.
3. Implement Tasks 2 and 3 for the first real receipt-to-card loop: Gemini extraction, private upload, validated confirmation, and atomic/idempotent server-side acceptance and rewards. Verify the configured Gemini access and establish a phone-reachable backend deployment when this work starts.
4. Continue card/reveal and profile/review/sharing lanes only against agreed shared contracts and persisted rewards. No client-calculated XP or unlabeled fixture data in live flows.

The five seeded restaurants cannot yet demonstrate a three-cafe badge; expand verified catalog coverage when needed.

For receipt extraction, the integrator recommends `GEMINI_MODEL=gemini-3.8-flash`, verified against [Google's current model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) on 2026-10-10. It supports image/PDF input and structured output. This is a starting recommendation, not a receipt-accuracy benchmark: evaluate real samples, validate against the shared Zod schema, retain unknown values, and require confirmation before rewards. Gemini credentials are configured locally; extraction implementation and receipt accuracy evaluation remain pending.

## References for agents

Read [product rules and implementation plan](foodie-cards-plan.md), [team workflow](team-workflow.md), [foundation interfaces and ownership](foundation-handoff.md), [setup](setup.md), `shared/contracts.ts`, and the migration before editing. API profiles use camelCase while PostgreSQL uses snake_case. Receipt dates are printed local dates; zero stars differs from unrated null.

Local, ignored working reports remain at `.superpowers/sdd/foodie-cards-plan/`: `progress.md`, `task-1-brief.md`, `foundation-report.md`, `mobile-report.md`, `database-report.md`, `setup-report.md`, `test-report.md`, and `checkpoint-review.md`. These are useful on this checkout; this tracked handoff preserves the important state for other checkouts.

Previous agent roles: `foundation_builder` owned root/shared/server/dependencies; `mobile_builder` owned mobile; `database_builder` owned schema/setup; `supabase_setup` owned hosted provisioning and ignored env files; `foundation_tester` verified; `schema_reviewer` and `checkpoint_reviewer` reviewed independently. Resume with fresh, explicit ownership rather than assuming prior agents are still active.

## Session decisions

- The published plan marked ready plus the user's request served as the approved baseline. If requirements differ, revise the foundation against the updated spec.
- Work stayed in the existing checkout on a feature branch, overriding the default new-worktree workflow. Preserve changes during branch switches.
- All delegated roles used Luna as requested, overriding skill defaults for stronger reviewer models. Complex findings may need additional review rounds.
- Scope stopped at Task 1, as the plan directs; later demo features remain pending.
- Supabase browser access was blocked. The user explicitly authorized a dedicated setup agent and scoped-token API access as the alternative; no browser workaround was used.
- Hosted migration application may use an atomic Management API query with CLI-compatible history if the migration endpoint cannot preserve the committed version. This is covered by the existing setup authorization; it must preserve exact version/name and roll back on failure.
- Reports are retained for the requested compaction handoff rather than deleting the ignored execution workspace.
