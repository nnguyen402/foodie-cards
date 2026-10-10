# Team ownership and integration

## Four work lanes

| Lane | Ownership | First deliverable |
|---|---|---|
| A: foundation/integration | Scaffold, auth, shared contracts, migrations/RLS, transactional progression and review awards, deployment | Authenticated acceptance awards progress exactly once |
| B: receipts/AI | Capture/upload UI, Gemini extraction, item normalization, editable confirmation | Real receipt becomes a valid editable draft |
| C: cards/visuals | Prepared assets, themes, reusable card, collection/detail, sorting, reveals and recovery | Contract-shaped milestone opens on the demo phone |
| D: profile/sharing | Profile, reviews UI/routes, pins, titles UI, public previews, native sharing, demo preparation | Profile shows reviews, owned pins, and equipped title |

A owns account award logic for both receipts and reviews. D's review route calls the transactional database function rather than independently calculating rewards.

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
- A coordinates shared contracts, migrations, root dependencies, and lockfiles. Other lanes propose changes through A.
- Follow the repository's actual scaffold once created; do not rebuild it merely to match directory names.
- Submit small pull requests with changed behavior, verification results, and integration dependencies.
- Merge frequently through the integrator; keep the main branch runnable.
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
