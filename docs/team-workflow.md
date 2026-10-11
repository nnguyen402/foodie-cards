# Team ownership and integration

Start with the [product requirements document](PRD.md) for the product goal, demo requirements, and acceptance criteria. The complete workflow is incorporated into section 5 of [the build plan](foodie-cards-plan.md). This document is a quick reference; follow the plan if details differ.

## Foundation first

One coordinating Codex agent supervised by A builds Task 1 plus shared interfaces and labeled fixtures before parallel feature implementation. Extend an existing Replit scaffold, or scaffold directly in this repository while preserving Replit backend hosting.

The handoff includes runnable mobile/backend scripts, auth and session persistence, profile/schema/RLS/private storage, route shells, agreed contracts for profile edits/pins/title equipment/reviews/reveal acknowledgement, representative fixtures, setup instructions, and physical-phone verification. Report outstanding credentials or phone checks honestly. Later feature endpoints need not be implemented yet.

Stop at the committed foundation handoff, then give teammates substantial feature lanes while A continues transactional progression. During foundation work, teammates prepare permissioned assets, real receipt samples, themes, and demo material.

## Four work lanes

| Lane | Ownership | First deliverable |
|---|---|---|
| A: foundation/integration | Scaffold, auth, shared contracts, migrations/RLS, transactional progression and review awards, deployment | Authenticated acceptance awards progress exactly once |
| B: receipts/AI | Capture/upload UI, Gemini extraction, item normalization, editable confirmation | Real receipt becomes a valid editable draft |
| C: cards/visuals | Prepared assets, themes, reusable card, collection/detail, sorting, reveals and recovery | Contract-shaped milestone opens on the demo phone |
| D: profile/sharing | Profile, reviews UI/routes, pins, titles UI, public previews, native sharing, demo preparation | Profile shows reviews, owned pins, and equipped title |

A owns account award logic for both receipts and reviews. D's review route calls the transactional database function rather than independently calculating rewards.

## Assignments to start now

The committed foundation is ready for parallel feature work: app shells, shared contracts and labeled fixtures, authenticated backend, hosted Supabase schema, and private storage are implemented. Read [the checkpoint handoff](checkpoint-handoff.md) for verification evidence and unresolved checks. Branch from the latest `main`; do not rebuild the scaffold. Lane letters are roles, not assigned teammate names.

| Owner | Start now | First reviewable result | Boundary and dependencies |
|---|---|---|---|
| B: receipts/Gemini teammate | Task 2: capture/library upload, private draft handling, server-side Gemini extraction and normalization, editable confirmation | Three real receipt samples produce editable drafts; uncertain items remain flagged; retry/error states preserve edits | Own receipt extraction/normalization and receipt UI. No XP awards. A owns submission/acceptance. Verify configured Gemini access without exposing keys. |
| C: cards/visuals teammate | Task 4: permissioned assets, five restaurant themes, one card layout with three stage treatments, collection/detail, reveal | Labeled fixtures demonstrate first unlock and evolution with skip/reduced-motion support on the iPhone | Own card features/assets and collection/detail/reveal screens. Connect persisted rewards after A's acceptance endpoint; coordinate review-editor placement with D. |
| D: profile teammate | Task 5 UI: profile, rating/review editor, owned pins, badges, unlocked-title selection | Contract-shaped profile/editor states work with labeled fixtures, including zero-star versus unrated and save failures | Own profile features/screens and review UI. Coordinate card-detail edits with C. A supplies transactional review awards; sharing/public previews are a later increment after the receipt-to-card loop. |
| A: user + integration coordinator | Task 3: atomic/idempotent acceptance, duplicate protection, server-side progression; phone-reachable backend deployment | An accepted receipt persists a card and correct XP exactly once; replay, cross-account duplicates, and concurrent submissions are tested | Own shared contracts, migrations, root dependencies/lockfile, receipt submission, receipt/review award logic, and integration. |

Assign one person the remaining foundation QA immediately: real iPhone signup/email confirmation/sign-in, relaunch/session restoration, sign-out/account switch, empty collection, backend connectivity, and authenticated two-user private-data/storage isolation. Record evidence and failures in the checkpoint handoff. Feature work can proceed against contracts/fixtures while this runs; live integration depends on resolving failures.

Each lane's first pull request should name changed files, include relevant tests/typecheck and phone evidence where applicable, and list outstanding integration dependencies. Keep fixtures explicitly labeled and outside live earned-progress flows. Do not commit credentials or real receipt files. Request shared-contract, migration, or dependency changes through A before editing them.

If only two feature teammates are available, assign B and C first. A retains integration and foundation QA coordination; defer D until the first live receipt-to-card loop works. No owner should independently compute or write XP from the phone.

## Before parallel implementation

1. Establish the runnable scaffold and scripts.
2. Agree on shared Zod/TypeScript contracts and API errors from the build plan.
3. Define profile editing, pins, and title-equipment interfaces explicitly.
4. Prepare labeled fixtures for an empty account, first unlock, ordinary receipt, evolution, duplicate error, and reviewed/pinned card.
5. Assign people to lanes and choose the physical demo phone.

## Agent workflow

- Each teammate uses a separate checkout or worktree and a lane branch.
- Each teammate's main agent coordinates their subagents and reviews the combined result.
- Give subagents explicit file ownership, expected inputs/outputs, and verification requirements. Avoid concurrent edits to the same files.
- Use isolated worktrees/branches for independent subagent edits where practical; the lane coordinator integrates and reviews the results.
- A coordinates shared contracts, migrations, root dependencies, and lockfiles. Other lanes propose changes through A.
- Follow the repository's actual scaffold once created; do not rebuild it merely to match directory names.
- Submit small pull requests with changed behavior, verification results, and integration dependencies.
- Merge frequently through the integrator; keep the main branch runnable.
- Update affected fixtures and notify dependent lanes when agreed contracts change; update from main before the next increment.
- Keep privileged credentials on the backend and real receipt files out of Git.

Suggested instruction for every lane agent:

> Read docs/foodie-cards-plan.md and the shared contracts. Implement only your assigned scope. Use the existing repository structure. Do not independently change shared contracts, database migrations, or root dependencies. Identify required changes for the integrator. Keep development fixtures clearly labeled. Report changed files, verification results, and integration dependencies.

## Integration order

1. A establishes auth, contracts, schema, and phone/backend connectivity.
2. B, C, and D build against agreed fixtures while A implements acceptance/progression.
3. Connect B -> A -> C early for the first live receipt-to-card loop.
4. Connect D's profile and reviews to persisted cards and transactional awards.
5. Freeze features, exercise failure recovery, and rehearse the complete physical-phone demo.

The product rules and scope in the build plan remain authoritative.

Prioritize the first live B -> A -> C receipt-to-card loop. If A is overloaded, shift isolated documentation/demo work to teammates so transactional awards and integration can finish.
