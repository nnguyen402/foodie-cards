# Lane A progression implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Execute the existing approved product rules; leave teammate mobile work untouched.

**Goal:** Persist authenticated receipt acceptance, progression, review awards, and recoverable reveals exactly once.

**Architecture:** Express verifies the bearer token and validates owned server drafts and catalog item matches. Service-role-only PostgreSQL transactions serialize rewards by locking the user's profile, protect global receipt uniqueness, and store the original acceptance response for retries.

**Tech stack:** Existing TypeScript/Express/Zod/Vitest and Supabase/PostgreSQL/pgTAP.

**Spec:** [PRD](../../PRD.md), [build plan Task 3 and A-owned Task 5 awards](../../foodie-cards-plan.md).

## Global constraints

- The project owner owns A; one teammate owns B+C, another D.
- Use the existing checkout on `feat/lane-a-progression`; preserve the user's directory preference and existing local secrets.
- No mobile changes, root dependency upgrades, fabricated extraction, or public receipt metadata.
- XP is computed inside the transaction; clients cannot execute reward functions.
- Preserve camelCase API contracts and snake_case database fields.
- Keep private files and credentials out of Git and test output.

## Review focus

- Concurrent requests for a user serialize all receipt/review awards; cross-user duplicate images/fingerprints roll back completely.
- Retrying an accepted submission returns the original result even after later progress or catalog changes.
- Foreign-owned drafts/items and idempotency-key reuse fail without revealing another user's data.
- Same-day receipts earn purchase XP without an extra visit; duplicate lines merge before quantity caps and item bonuses.
- Reveal acknowledgement preserves the first timestamp; unviewed highest-stage events remain recoverable.

## Task 1: Database acceptance and review transactions

**Files:** new `supabase/migrations/20261010000200_foodie_cards_progression.sql`, `supabase/tests/progression.test.sql`.

**Interfaces:** `accept_receipt(p_user_id uuid, p_receipt_id uuid, p_submission_id uuid, p_confirmed jsonb)` returns `ProgressionResult`. Confirmed items additionally contain server-resolved `menuItemId`. `save_review(p_user_id uuid, p_restaurant_id uuid, p_rating numeric, p_text text)` returns `ReviewResponse`. All reward RPCs are service-role-only.

- [x] Write and run failing SQL behavioral tests for exact scoring, ownership, replay, stages, badge/title thresholds, review edits, and function privileges.
- [x] Add `receipts.acceptance_result` for immutable replay; validate draft/hash/catalog; merge items; calculate canonical fingerprint and lock profile/draft; persist receipt/items/visits/card/user items and all awards atomically.
- [x] Implement shared badge/title evaluation and review save using the same profile lock; award no card XP for reviews.
- [x] Run new and foundation SQL tests against the local stack without resetting hosted data. Add real concurrent-session checks.

## Task 2: Validated authenticated backend paths

**Files:** `server/src/progression/rules.ts`, `server/src/receipts/submit.ts`, focused routes/services, `server/src/app.ts`, `server/src/auth.ts`, and `server/tests/*`.

**Interfaces:** existing `ConfirmedReceipt`, `ProgressionResult`, `ReviewRequest`, `ReviewResponse`. `POST /api/receipts/submit`, `PATCH /api/reviews/:restaurantId`, `GET /api/rewards/pending`, `POST /api/rewards/:eventId/viewed`.

- [x] Write and run failing rule tests: first new item 140 XP; three prior visits familiar/new pair 105 XP; receipt-wide quantity cap; same-day zero visit XP; both stage gates.
- [x] Validate inputs, verified user and owned server draft, exact catalog canonical/alias matching, hash/path provenance, RPC arguments and safe error mapping. No Gemini implementation in A.
- [x] Add review and reveal paths with ownership checks, idempotent acknowledgement, contract validation, and authenticated error tests.
- [x] Run the full JavaScript suite and typecheck. Exercise RPC parity through the real database tests from Task 1.

## Task 3: Review, integration and teammate handoff

**Files:** `docs/lane-a-handoff.md`, team workflow, PRD and checkpoint.

- [x] Review combined changes independently for spec compliance/security and resolve findings.
- [x] Run fresh tests/build/SQL checks and inspect the complete diff; record verification and remaining phone/deployment gates.
- [x] Document B+C draft persistence requirements and submission/reveal calls; D transactional review interface and ownership boundaries.
- [x] Commit the reviewable checkpoint. Hosted rollout remains a separate step after local verification and review, preserving migration history. Record actual status accurately.

Public backend deployment and physical iPhone verification require the corresponding environment/device access; complete all locally available backend work first and identify the concrete remaining gate.
