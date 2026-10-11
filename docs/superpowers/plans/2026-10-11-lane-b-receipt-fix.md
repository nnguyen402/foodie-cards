# Lane B receipt reading implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement these independent tasks with explicit file ownership and a combined review.

**Goal:** Update PR #4 so authenticated users can photograph/upload a receipt, receive a private persisted editable draft, and confirm through Lane A's API when available.

**Architecture:** Keep the existing Expo/Express/Supabase foundation. Register authenticated multipart extraction and owned draft retrieval, use the private receipts bucket, and preserve the shared draft contract. Optimize the configured Gemini Flash reader with low thinking; keep rewards in Lane A.

**Tech Stack:** Existing TypeScript, Expo, Express, Supabase, Gemini REST, Zod, Vitest; Multer for bounded multipart parsing and Expo image picker/manipulator for capture and conversion.

**Spec:** docs/foodie-cards-plan.md, Tasks 2–3; approved photo → extraction → editable confirmation scope in this session.

## Global constraints

- Keep real images and credentials out of Git. Do not apply migrations to the live service or merge other lane PRs.
- Extraction awards no XP. Submission uses the existing ConfirmedReceipt/ProgressionResult contracts and Lane A endpoint.
- Authenticate before reading multipart data. Accept one JPEG/PNG/WebP image, maximum 10 MiB, with signature validation.
- Keep incomplete extraction fields nullable in draft rows, while requiring complete fields for later receipt statuses.
- Preserve loading, retry, cancellation, account isolation, user corrections, and a stable submission ID across retries.
- Maintain the 30-second Gemini timeout; low thinking must be compatible with the configured model. The mobile upload timeout must accommodate the existing one retry.

## Review focus

- Missing/expired tokens and foreign-owned draft IDs never expose drafts or invoke extraction.
- Oversized, empty, disguised, or extra file uploads fail before storage/AI.
- Missing dates/totals and unsupported restaurants produce editable drafts rather than invented values.
- Account changes during upload/loading/submission cannot publish another account's results.
- Failed submissions preserve edits and retry the same submission ID; unavailable Lane A routes produce an honest error.

## Task 1: Reader latency and extraction quality

**Files:** server/src/receipts/extract.ts; server/tests/receipts.test.ts.

- [ ] Add failing coverage for low-thinking Gemini 3 Flash requests, older-model compatibility, and retained restaurant name/alias matching.
- [ ] Add optional restaurant catalog input and preserve extracted restaurantName in the draft; resolve only unambiguous matches.
- [ ] Set low thinking by default on supported Gemini 3 Flash models, with validated GEMINI_THINKING_LEVEL override; avoid unsupported parameters on older models.
- [ ] Keep original image quality, date validation, one transient retry, and the 30-second timeout; group modifiers/translations in the extraction prompt.
- [ ] Run covering tests and report red/green evidence.

## Task 2: Authenticated upload and private draft storage

**Files:** server/src/app.ts; server/src/index.ts; server/src/receipts/routes.ts; server/src/receipts/store.ts; server/tests/receipt-routes.test.ts; server/tests/receipt-store.test.ts; supabase/migrations/20261011000100_receipt_draft_fields.sql; supabase/tests/receipt_drafts.test.sql.

**Interfaces:** createApp(authDependencies?, receiptDependencies?); receiptDependencies expose extractImage(image, catalog), listRestaurants(), saveDraft(userId, image, draft), loadDraft(userId, draftId). GET /api/receipts/restaurants returns { restaurants: [{ id, name, locationLabel }] }. POST /api/receipts/extract accepts multipart image and returns ReceiptDraft. GET /api/receipts/drafts/:draftId returns owned ReceiptDraft or NOT_FOUND.

- [ ] Write and run failing route tests for authenticated multipart extraction, image validation, failures, owned retrieval, and missing configuration.
- [ ] Implement router and Supabase adapter with generated user-scoped image paths, server SHA-256 hashes, stable saved draft IDs, and cleanup after failed draft persistence.
- [ ] Add a migration permitting null essential fields only for draft status, preserving all RLS and progression constraints. Add SQL coverage for own/foreign access and completed-status completeness.
- [ ] Register dependencies in startup; do not log secrets or model/provider response bodies to clients.
- [ ] Run covering tests/typecheck and report evidence.

## Task 3: Mobile capture, upload, and real confirmation

**Files:** mobile/app/(tabs)/scan.tsx; mobile/app/receipt/confirm.tsx; mobile/src/features/receipts/*; mobile/tests/receipt-api.test.ts; mobile/tests/receipt-state.test.ts.

- [ ] Add failing tests for URL/auth/payload/error contracts and retry identity/account-isolated draft state.
- [ ] Add camera and library actions, camera-denial fallback, JPEG conversion/compression, size checks, progress/error/retry states, and cancellable authenticated multipart upload.
- [ ] Navigate using the saved draft ID. Load the real owned draft and restaurant catalog; remove fixture use and free-text restaurant IDs.
- [ ] Support correcting date, receipt number, total/currency, item names/quantities, adding/removing items, and retaining edits after errors.
- [ ] Send a validated ConfirmedReceipt with a stable UUID submission ID to Lane A's submit endpoint. Show actual rewards only after its successful response; handle a missing route honestly.
- [ ] Run tests/typecheck and report evidence; physical-device QA remains a separate manual check if unavailable.

## Integration and delivery

- [ ] Coordinator manages shared additive schemas and all dependency/lockfile changes.
- [ ] Run full tests, typechecking, and Expo Doctor. Review combined changes with a Luna agent; resolve important findings.
- [ ] Retest all three user-provided receipt images with production extraction code, saving evidence outside Git.
- [ ] Document settings, migration/setup requirements, and Lane A dependency. Verify staged files contain no credentials or real receipts.
- [ ] Commit and push only reviewed Lane B changes to origin/lane-b/receipts; update PR #4 description with behavior and verification. Do not merge.
