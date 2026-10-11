# Lane A backend integration handoff

Implementation branch: `feat/lane-a-progression`. This document describes the integration boundary; consult the checkpoint for verified deployment status. The project owner is A, one teammate owns B+C, and another owns D.

Backend checkpoint `f78513f` is pushed on that branch; `main` is unchanged by this work. Both A migrations are applied locally and to the configured hosted Supabase project. Local verification passed 57 JavaScript tests, 159 SQL checks, five concurrency checks, build/typecheck, and real Auth/PostgREST/HTTP integration. B+C and D can use these backend interfaces from A's branch now; merge through a PR later.

## B+C: receipt to card

Keep capture, upload, extraction, normalization UI, collection/detail, and reveals in your lane. A owns `server/src/receipts/submit.ts`, shared contracts, migrations, acceptance and rewards. Coordinate route registration in `server/src/app.ts` through A.

The extraction backend must persist a server-owned row in `receipts` and return its UUID as `ReceiptDraft.draftId`. Use the verified bearer user's UUID as `user_id`. Upload images to the private `receipts` bucket under `<user-id>/...`; calculate the SHA-256 image hash from the uploaded bytes on the backend. Never accept the path, hash, ownership, or XP from the confirmation client. Keep the original extraction in `extraction_draft`.

Unresolved restaurant/date/total/currency may be null while the row is a draft; essential fields must be resolved before acceptance. Do not invent values to satisfy a database constraint. Store image path and server-generated image hash before allowing confirmation submission. The server must never persist an accepted status from extraction alone.

Submit the existing `ConfirmedReceipt` shape to `POST /api/receipts/submit` with a Supabase bearer token. `draftId`, `submissionId`, and `restaurantId` are UUIDs; generate one submission UUID when the user confirms, retain it across retries, and do not generate a new key just because the response timed out. Items use the catalog's canonical names or known aliases; unsupported dishes require correction. A resolves menu IDs and merges repeated dishes before scoring.

Acceptance returns `ProgressionResult`. The additive `stageAwards` array lists each newly crossed stage and its account XP, while `stage` and `revealEventId` identify the highest visual result. Older labeled fixtures may omit the array. Retrying the same accepted draft/submission returns the originally stored result; it does not apply later edits or earn new rewards. A new submission using an already accepted image/fingerprint returns `DUPLICATE_RECEIPT` without exposing the prior submitter. Keep edits on retryable failures and show the safe API message.

`revealEventId` is null for ordinary progress. If present, display the milestone and reward summary. `GET /api/rewards/pending` recovers owned unviewed milestone results. Call `POST /api/rewards/:eventId/viewed` only after completion or explicit skip. Repeated acknowledgement preserves its first timestamp. Recovery/replay never awards XP.

## D: profile and reviews

A owns backend review/profile actions, schema changes, ownership validation, and account reward transactions. D owns mobile screens/editors and public sharing presentation. Do not implement a second reward calculator or duplicate server review route.

`PATCH /api/reviews/:restaurantId` accepts the existing `ReviewRequest` (`rating`, `text`) and returns `ReviewResponse`. Only an owned unlocked card may be reviewed. Zero stars and null are distinct. Negative reviews earn the same written-review recognition; editing does not award twice. Clearing text does not revoke earned badges or titles.

Profile actions use the existing shared contracts: `PATCH /api/me` edits display name/avatar and returns `{ profile }`; `PUT /api/me/pins` atomically replaces up to three owned pins and returns `{ pins }`; `PUT /api/me/title` equips an unlocked title or null and returns `{ equippedTitleKey }`. A supplies verified-user RPC adapters; the client never supplies a target user ID or writes account XP.

## Verification and rollout

Run `npm test`, `npm run build`, and `npx supabase test db` against the local stack. Run `python scripts/check-progression-concurrency.py` for independent simultaneous SQL sessions and `node --import tsx scripts/check-backend-integration.mjs` for real local Auth/PostgREST/HTTP integration. Both scripts use synthetic accounts, clean up after themselves, and target the local Supabase stack only. Reward SQL functions are service-role-only. Hosted migrations must be applied from the committed files, with matching migration history; no dashboard-only changes or database reset.

Physical iPhone auth/session tests, hosted two-user privacy tests, real Gemini extraction, and public backend deployment remain separate gates. Local fixtures and SQL test receipts are explicitly synthetic; do not use them to claim live extraction or a completed phone demo.

Reference [PRD](PRD.md), [team workflow](team-workflow.md), [Lane A plan](superpowers/plans/2026-10-10-lane-a-progression.md), and [shared contracts](../shared/contracts.ts).
