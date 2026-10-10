# Foodie Cards — Hacklanta Build Plan

> **For agentic workers:** Read the product brief and contracts in this file before implementing. Use `superpowers:executing-plans` when available to work task by task. Checkboxes track deliverables. Implementation starts with the Replit scaffold, then continues through the shared GitHub repository using external coding tools.

**Goal:** Build a polished mobile food journal where accepted receipts create and evolve personal restaurant cards, increase account levels, and unlock badges and titles.

**Architecture:** An Expo mobile app uses Supabase for authentication, PostgreSQL data, and private receipt storage. A TypeScript backend on Replit calls Gemini and validates receipt submissions. One transactional database function records each accepted receipt and awards progression; the mobile app displays the resulting milestone animation.

**Tech stack:** Expo, React Native, TypeScript, Expo Router, React Native Reanimated, Expo Image Picker, Expo Haptics, Supabase, Node.js/Express, Gemini API, Zod, Vitest, GitHub.

**Spec:** The product brief and rules below are the design specification for this plan.

**Prize priorities:** Creative track first, Best Use of Gemini API second, GoDaddy domain side quest third. No restaurant-owner dashboard, Photon agent, or Replit Small Business challenge in the initial scope. Replit is the initial build environment and backend host.

**Status:** Ready for team review and Replit handoff. The numbers and technical defaults below are proposed implementation defaults, selected to remove ambiguity; they can be tuned after the complete flow works.

## 1. Product brief

Foodie Cards turns real dining experiences into a personal collection of evolving restaurant cards. Scan a receipt, confirm its contents, and earn progress for visiting a restaurant, trying new dishes, and returning to familiar favorites. Important milestones trigger a card-opening animation. Your restaurant cards level your account, and your profile displays your favorite restaurants, reviews, badges, and an equipped title.

These are your cards. There is no trading, random restaurant draw, battle system, or marketplace. Restaurant-card levels measure your experience with a place. Your personal rating measures how much you like it.

### Required demo

1. Create an account and profile.
2. Photograph or upload a restaurant receipt.
3. Gemini extracts the restaurant, date, receipt number, total, and purchased items.
4. Confirm or correct the extracted details.
5. Submit the receipt and open your first restaurant card.
6. Submit a later receipt and see an explanation of earned XP.
7. Reach a milestone and open the evolved version of that same card.
8. See account XP increase, unlock a title, and equip it.
9. Rate the restaurant, write a review, and pin it to your profile.
10. Share the card or profile.

### Initial scope

- Five curated Atlanta restaurants or cafés using one reusable card layout, a simple visual theme per restaurant, and three shared upgrade treatments.
- One personal card per user per restaurant location. Separate locations have separate cards.
- Email/password accounts, a display name, and an avatar selected from bundled artwork.
- Receipt scanning, editable confirmation, duplicate rejection, and progression.
- Collection, card detail, personal ratings/reviews, profile, badges, titles, and sharing.
- Restaurant matching against the curated catalog; an uncertain match asks the user to select a supported restaurant. Unsupported restaurants do not award progress in this version.
- Primary demo on a team's physical phone. Use cross-platform Expo components, but prove the chosen demo phone works before promising both operating systems.

### Deferred

Friends, feeds, public rating aggregates, maps, live restaurant search, automatic Google Places image retrieval, recommendations, push notifications, coupons, owner dashboards, payments, trading, and additional sponsor integrations. AI-generated card artwork is not part of the visual direction.

## 2. Product rules

### Receipt acceptance

- Users can take a photo or select one from their library. Denied camera permission offers library upload.
- Gemini proposes fields; the user confirms the supported restaurant, local receipt date, and purchased food/drink items. A receipt number may be absent. Missing or unreadable essential information asks for a clearer image.
- Exclude tax, tips, service fees, discounts, payment lines, and other non-item lines from food XP.
- Keep original receipt text beside suggested dish names so users can correct abbreviations.
- A model's uncertain guess must not silently add extra items or quantities. Default an unspecified quantity to one.
- A receipt can be accepted only once across the app. Check its image hash plus a fingerprint of restaurant, date, receipt number when present, total/currency, and sorted item/quantity pairs. On an ambiguous collision, do not silently award again or claim proven fraud; explain that the receipt appears to have been submitted already.
- Corrections do not let users change ownership of an already accepted receipt.
- Multiple accepted receipts for the same restaurant and local date count as one visit for that user's visit count, visit bonus, and veteran status. Additional unique receipts can still earn purchase XP.
- Shared meals: the account submitting the receipt gets the credit. Receipt splitting between diners is deferred.
- Receipt-based progression and duplicate detection are not merchant-backed proof of authenticity. Do not describe them as fraud-proof.

### Restaurant-card XP

| Action | Base XP |
|---|---:|
| First distinct visit date at this restaurant | 100 |
| Each later distinct visit date | 50 |
| Each distinct normalized item on this receipt | 10 |
| Each normalized item never purchased here before | Additional 30 |
| Additional units of an item beyond its first unit | 2 per unit, capped at 10 total per receipt |

Merge duplicate line items before counting distinct items and quantities. New-item bonuses are awarded once per user/restaurant/item. The additional-unit cap is across the entire receipt, not per item.

**Veteran multiplier:** Based on distinct visit dates completed before the current receipt; multiply purchase XP only.

| Previous visits | Multiplier |
|---|---:|
| 0–2 | 1.0× |
| 3–5 | 1.1× |
| 6–9 | 1.2× |
| 10+ | 1.3× |

`purchaseBase = 10 × distinctItems + 30 × newItems + min(10, 2 × additionalUnits)`

`receiptXP = visitBonus + floor(purchaseBase × veteranMultiplier)`

Example: a user with three prior visits returns on a new date for one familiar coffee and one new pastry. Visit XP is 50; purchase base is 20 + 30 = 50; multiplied purchase XP is 55; total is **105 XP**. A familiar coffee alone on that visit earns **61 XP**.

### Card stages and openings

| Stage | Conditions | Account XP award |
|---|---|---:|
| Discovered | First accepted receipt | 100 |
| Regular | At least 300 card XP AND 3 distinct visit dates | 150 |
| House Favorite | At least 750 card XP AND 6 distinct visit dates | 300 |

- The first unlock and each stage evolution award account XP once.
- Regular receipts show an XP summary; milestone receipts additionally open the new card version.
- Evolved versions replace the visible previous version while preserving all dining history.
- Prepare restaurant images, bundled fonts, and reusable frame treatments in advance and preload them. Opening must not wait for image retrieval or generation.
- Card XP continues after House Favorite, with the next-goal message indicating the highest visual stage has been reached.
- Progress UI shows XP and visit requirements separately. Example: “240/300 XP · 2/3 visits.” Do not imply that either condition alone guarantees an opening.
- If one submission satisfies multiple unearned stages, award every crossed stage exactly once, show one opening of the highest stage, and list all rewards in its summary.
- Backend responses include milestone event IDs. Animation replay never awards XP. Mark a reveal viewed only after it finishes or the user explicitly skips; interrupted reveals can be recovered.

### Simple restaurant personalization

Use **one reusable card layout**, not a custom design or separate illustration for every restaurant. The restaurant's personality comes from four small choices:

| Theme field | Implementation |
|---|---|
| Primary and accent colors | Two manually selected colors per demo restaurant |
| Name font | One of four bundled styles: rounded, bold, elegant, or friendly |
| Hero image | Restaurant logo, storefront photo, or food photo |
| Optional decoration | One subtle background pattern or category icon; may be omitted |

- Name, image, rating, stage badge, and personal progress keep the same layout across the collection.
- If a usable logo is available, display it in a contained image area; otherwise use a storefront photo. If neither is available, use a food photo with the restaurant name in a fitting font. If no image is available, use the category background and icon.
- Fonts suggest the restaurant's vibe rather than reproducing its exact brand lettering. Bundle four appropriately licensed font families once; map theme keys to those families. Do not download a new font for each restaurant.
- Example: playful fast food uses red accents and rounded/bold lettering; an upscale Japanese restaurant uses restrained colors and elegant lettering; a neighborhood café uses warm colors and friendly lettering. Theme follows the actual restaurant's personality, not cuisine stereotypes. Use the actual restaurant name.
- Manually choose themes and images for the demo catalog. A restaurant missing theme fields gets a category default; an unknown category gets the neutral default.
- Use photos taken by the team or restaurant-provided assets with permission for the initial catalog. Store these prepared assets in Supabase Storage or bundle them, as appropriate. Do not depend on Google Places to make the initial reveal work.
- If Google Places is added later, treat it as an optional runtime source with a photo fallback, required attribution, and applicable storage restrictions. Store permitted Place IDs; do not import Google photos or expiring photo references as permanent Supabase artwork. Places photos are not guaranteed logos or storefronts.
- Make text readable over photos with a stable text panel or contrast overlay. Theme colors must not make labels unreadable.

**Shared upgrade treatments:** Discovered has a clean frame; Regular adds a richer border and modest accent detail; House Favorite adds a premium border, restrained shine, and a title ribbon. Keep the restaurant's image, font, and theme colors consistent through upgrades. These are three reusable treatments, not fifteen separately painted cards.

### Account levels, badges, and titles

- Account XP comes from restaurant-card stages and first-time badge awards.
- `accountLevel = 1 + floor(accountXP / 200)`.
- Each badge grants 50 account XP once. Review badges require written reviews, not stars alone.
- A title is an equippable label. Unlocks are permanent in this version; deleting a review does not claw back a previously earned badge.
- Evaluate badge awards first, then titles against the resulting account XP. Titles award no additional XP.

| Badge | Requirement | Title unlocked |
|---|---|---|
| First Bite | First restaurant card | None |
| Café Crawler | Three different café cards | Café Crawler |
| Menu Explorer | Ten distinct restaurant/item combinations purchased | Menu Explorer |
| Loyal Regular | One House Favorite card | Loyal Regular |
| First Impressions | One restaurant with a written review | None |
| Food Critic | Ten restaurants with written reviews | Food Critic |
| Seasoned Reviewer | Twenty-five restaurants with written reviews | Seasoned Reviewer |
| Critic's Club | Fifty restaurants with written reviews | Critic's Club |

Additional titles: **Ultra Foodie** at account level 5; **Mega Food Crawler** at twenty restaurant cards. Higher-count rewards remain visible future goals and need not be demonstrated with the five-restaurant catalog. Do not inflate thresholds or fabricate real activity to show them.

### Ratings and profile

- One editable personal rating per restaurant: 0–5 stars, in half-star increments. `null` means unrated; zero is a valid rating.
- Optional written review, maximum 500 characters; whitespace-only text does not count as a review.
- Review entry requires an unlocked restaurant card. Review edits do not count as additional restaurants reviewed.
- No card XP for ratings or reviews, and no reward depends on a positive rating.
- Pin up to three owned restaurant cards as Top Restaurants, independent of card XP or rating order.
- Profile: display name, avatar, level/progress, equipped title, pinned restaurants, collection, badges, and counts of restaurants, visits, and dishes.
- Collection sorting: highest personal rating, highest card XP, most recently visited. Unrated cards appear after rated cards in rating sort.
- Public sharing exposes selected profile/card information, never receipt images, receipt numbers, authentication details, or purchase totals. Show the sharing preview before the user sends the link.

## 3. Global constraints

- Use Supabase exclusively for accounts, application data, and receipt file storage. Do not provision a second database in Replit.
- Use the Expo template's supported SDK and align native dependencies with `expo install`; do not independently upgrade React Native.
- Use TypeScript across mobile, backend, and shared contracts.
- Keep Gemini and Supabase privileged keys on the backend. Only the Supabase URL and publishable key belong in the mobile bundle.
- Receipt files are private. Database access is controlled with Supabase Row Level Security; the server verifies authenticated users for every write.
- Progression awards are transactional and idempotent. The client cannot directly write XP, stages, badges, or titles.
- AI proposes extraction and dish normalization; fixed server/database rules decide rewards.
- Verify the Gemini model supports image input and structured output using the team's available API credentials before integrating it. Configure its model ID in a server environment variable.
- Do not build the owner dashboard or other sponsor features before the core app works.
- Use one GitHub repository. Keep shared schema, contracts, and dependency changes under one designated integrator.
- Schema migrations are committed files. Teammates do not make independent unrecorded dashboard schema edits.
- Use explicit demo labels for synthetic fixtures. A recorded fallback supplements, rather than disguises, live functionality.

## 4. Repository structure and interfaces

The initial Replit scaffold should follow this structure. If Replit generates a different layout, map these responsibilities to its existing files once instead of rebuilding a working scaffold solely to rename directories.

```text
mobile/
  app/                         Expo Router routes
    (auth)/sign-in.tsx
    (tabs)/collection.tsx
    (tabs)/scan.tsx
    (tabs)/profile.tsx
    receipt/confirm.tsx
    card/[id].tsx
    reveal/[eventId].tsx
  src/
    lib/                       Supabase client, backend client, environment
    features/receipts/          Capture, confirmation, upload state
    features/cards/             Card view, opening, progression summary
      themes.ts                Restaurant/category theme resolution
      stageStyles.ts           Three shared upgrade treatments
    features/profile/           Pins, badges, titles, ratings/reviews
    assets/cards/               Prepared logos/photos and reusable decoration
    assets/fonts/               Four bundled licensed font families
server/
  src/
    index.ts                   Express startup and route registration
    auth.ts                    Supabase token verification
    receipts/                  Extraction, normalization, submission routes
    progression/rules.ts       Pure scoring helpers
    sharing/                   Public card/profile pages
  tests/                       Behavioral tests for receipts and progression
shared/
  contracts.ts                 Zod schemas and shared TypeScript types
supabase/
  migrations/                  Tables, RLS, constraints, award transaction
  seed.sql                     Supported restaurants and dishes
docs/
  demo-script.md
  setup.md
```

### Essential data model

- `profiles`: user ID, display name, avatar key, account XP, equipped title key, share token.
- `restaurants`: ID, name, location label, category, aliases, nullable `hero_image_path`, nullable `hero_image_kind` (`logo`, `storefront`, or `food`), nullable `theme` JSON with primary/accent colors, font key, and optional pattern key. Card stages share reusable frame treatments; do not store three separate artwork paths per restaurant.
- `menu_items`: ID, restaurant ID, canonical name, aliases.
- `cards`: user ID, restaurant ID, card XP, stage, visit count, last visit date; unique user/restaurant.
- `receipts`: ID, user ID, restaurant ID, local date, optional receipt number, total in minor currency units, currency, private image path, image hash, fingerprint, server-owned extraction draft, status, submission ID.
- `receipt_items`: receipt ID, menu item ID, original text, quantity.
- `visits`: user ID, restaurant ID, local date; unique user/restaurant/date.
- `user_items`: user ID, restaurant ID, menu item ID; unique combination, with first purchase date.
- `reviews`: user ID, restaurant ID, nullable rating, text; unique user/restaurant.
- `badge_awards`: user ID, badge key; unique combination.
- `title_unlocks`: user ID, title key; unique combination.
- `profile_pins`: user ID, card ID, slot 1–3; unique user/slot and user/card.
- `reward_events`: user ID, receipt ID when applicable, event type, reward key, payload, viewed timestamp; uniqueness prevents repeat stage/badge awards.

Purchase totals support receipt matching; do not use them for spending-based progression.

### Shared contracts

Define and export these types in `shared/contracts.ts` before feature work:

- `RestaurantTheme`: `{ primaryColor: string, accentColor: string, fontKey: 'rounded' | 'bold' | 'elegant' | 'friendly', patternKey: 'none' | 'dots' | 'lines' | 'paper' }`. Colors are validated hex values. `resolveRestaurantTheme(category, overrides)` returns a complete theme by applying validated overrides to category defaults, with neutral fallback.
- `ReceiptDraft`: `{ draftId, restaurantId: string | null, receiptDate: string | null, receiptNumber: string | null, totalMinor: number | null, currency: string | null, items: Array<{ originalText, suggestedName, quantity }>, warnings: string[] }`.
- `ConfirmedReceipt`: `{ draftId, submissionId, restaurantId, receiptDate, receiptNumber: string | null, totalMinor, currency, items: Array<{ originalText, confirmedName, quantity }> }`.
- `ProgressionResult`: `{ receiptId, cardId, xpBreakdown: { visitXP, purchaseBaseXP, multiplier, purchaseXP, totalXP }, cardXP, visitCount, stage, accountXP, accountLevel, newBadges: string[], newTitles: string[], revealEventId: string | null }`.
- `ApiError`: `{ code, message, retryable }`; define `UNAUTHORIZED`, `INVALID_RECEIPT`, `UNSUPPORTED_RESTAURANT`, `DUPLICATE_RECEIPT`, `AI_UNAVAILABLE`, and `UPLOAD_FAILED`.

Dates are `YYYY-MM-DD` as printed on the receipt; quantities are positive integers. Rating values are null or multiples of 0.5 between zero and five.

### Network boundaries

- `POST /api/receipts/extract`: authenticated multipart image upload; backend creates a private draft and returns `ReceiptDraft`. Image hashes are computed by the server.
- `POST /api/receipts/submit`: authenticated `ConfirmedReceipt`; backend checks draft ownership and validates/canonicalizes items, then returns `ProgressionResult`.
- `POST /api/rewards/:eventId/viewed`: authenticated; mark an owned reveal consumed without changing rewards.
- `PATCH /api/reviews/:restaurantId`: authenticated `{ rating, text }`; validate card ownership, update review, and award newly eligible review badges transactionally. Return review plus account XP/level and new badges/titles.
- Mobile reads its collection/profile via Supabase with RLS, and updates only permitted profile fields and pins. XP and equipped-title eligibility cannot be bypassed by direct client writes.
- `GET /p/:shareToken` and `GET /p/:shareToken/cards/:restaurantId`: backend-rendered public previews containing only approved fields. Escape user-written text and keep this page lightweight.
- The backend verifies the Bearer token through Supabase and derives the user ID from it. Never accept a user ID in request data as authority.
- Database RPC `accept_receipt(p_user_id, p_submission_id, p_receipt_id, p_confirmed_receipt)` is called only by the privileged backend. It locks the user's progression, enforces duplicate constraints, records items/visits, computes XP/stages, awards badges/titles, and returns `ProgressionResult` in one transaction. Repeated submission IDs return the original result.
- Database RPC `save_review_and_award(p_user_id, p_restaurant_id, p_rating, p_text)` similarly owns review awards and locks account progression. Restrict both RPCs to the backend role.

## 5. Team ownership and build order

Assign by strengths, not degree titles. These are four human work lanes; they do not require automated sub-agents.

| Person | Owns | First deliverable |
|---|---|---|
| A — integrator/backend | Shared contracts, Supabase migrations/RLS, auth verification, transactional progression, deployment | Authenticated receipt submission persists and awards exactly once |
| B — receipt/AI | Capture/upload, Gemini extraction, dish normalization, confirmation UI | One real receipt becomes an editable draft |
| C — cards/visuals | Reusable card template, restaurant themes/photos, collection, detail, animations, haptics | A themed restaurant card opens smoothly on the demo phone |
| D — profile/demo | Profile, ratings/reviews, badges/titles UI, sharing, demo preparation | A profile shows pinned cards and an equipped title |

All four agree on `shared/contracts.ts` first. A coordinates changes to it, database schema, and root dependencies. Others develop against fixtures matching the contracts until endpoints are ready. Integrate early rather than waiting for complete screens.

### Time allocation

Use proportions of the remaining time because the actual start time may differ:

- First 15%: scaffold, phone smoke test, contracts, auth, database, Gemini sample.
- Next 35%: complete the live receipt-to-first-card flow.
- Next 25%: progression/evolution, profile, reviews, badges, titles.
- Next 10%: sharing, GoDaddy setup, polish.
- Final 15%: feature freeze, failure testing, demo rehearsal, recording, submission.

Keep the team's **Sunday 8:00 a.m. internal cutoff**. The published Devpost currently lists October 11, 2026 at 9:00 a.m. EDT, but do not spend the internal buffer on features. Verify any organizer announcements.

## 6. Implementation tasks

### Task 1 — Runnable scaffold and authenticated profile

**Files:** Root workspace/package configuration; `mobile/app/(auth)/sign-in.tsx`; tab routes; `mobile/src/lib/supabase.ts`; `mobile/src/lib/api.ts`; `server/src/index.ts`; `server/src/auth.ts`; `shared/contracts.ts`; initial Supabase migration; `docs/setup.md`.

**Interfaces:** Produces shared types, authenticated backend requests, and `GET /health` returning `{ ok: true }`. Supabase session identifies the user throughout later tasks.

- [ ] Scaffold an Expo/TypeScript app and Express/TypeScript backend in Replit. Set up root scripts for mobile, server, type checking, and server tests.
- [ ] Connect GitHub and commit the runnable scaffold. Export locally once to confirm external editing works without replacing the project's architecture.
- [ ] Configure Supabase and server secrets. Document exact environment-variable names: mobile `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`; server `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- [ ] Implement email/password sign-in, persisted sessions, profile creation, sign-out, and protected routes. Never display a previous user's cached collection after account switching.
- [ ] Create initial schema, private receipt bucket, RLS, and curated restaurant seed. Record all changes in migrations.
- [ ] Run `npm run typecheck` and `npx expo-doctor` in the mobile project. Expected: no unresolved type errors or dependency compatibility errors.
- [ ] Open the app on the chosen physical demo phone. Confirm sign-in, relaunch persistence, sign-out, and backend connectivity. Resolve iPhone installation/account requirements now.
- [ ] Verify user A cannot read user B's receipt files or private data. Commit this working foundation.

### Task 2 — Real receipt to editable confirmation

**Files:** `server/src/receipts/extract.ts`; `server/src/receipts/normalize.ts`; `server/tests/receipts.test.ts`; `mobile/src/features/receipts/*`; `mobile/app/(tabs)/scan.tsx`; `mobile/app/receipt/confirm.tsx`.

**Interfaces:** Consumes shared receipt types and authenticated upload; produces `POST /api/receipts/extract` and `ReceiptDraft`. `normalizeItems(restaurantId, items)` returns canonical menu item IDs, merged quantities, and unresolved items for confirmation.

- [ ] Write behavioral tests: non-food lines are excluded; missing quantity becomes one; duplicate dish lines merge; unknown restaurant remains unresolved; two known aliases map to one dish; uncertain names remain flagged rather than invented.
- [ ] Run `npm run test:server -- receipts`. Expected: new behavior tests fail before implementation, then pass after the relevant code is added.
- [ ] Send one actual receipt image through Gemini using image input and a structured schema. Validate the output with Zod; preserve original item text. Do not use AI-generated receipt fields as proof of authenticity.
- [ ] Implement private draft storage and ownership checks. Accept JPEG/PNG/WebP files up to 10 MB; resize/compress captures before upload. A capture conversion failure offers another upload.
- [ ] Implement restaurant selection, editable date/items/quantities, removal of misread lines, and confirmation. Do not calculate rewards from the mobile draft.
- [ ] Add visible loading, retry, and error states. Use a 30-second request timeout with at most one automatic retry for transient Gemini failure; extraction retries must not award anything.
- [ ] Run receipt tests and type checking. Manually scan three different real receipts, including one abbreviated menu and one poor image. Confirm errors preserve user edits where possible. Commit.

### Task 3 — Atomic acceptance and progression

**Files:** `server/src/progression/rules.ts`; `server/src/receipts/submit.ts`; `server/tests/progression.test.ts`; `server/tests/submission.integration.test.ts`; Supabase progression migration; receipt confirmation submission UI.

**Interfaces:** Consumes `ConfirmedReceipt`; produces `ProgressionResult` through `POST /api/receipts/submit` and backend-only `accept_receipt`. Pure helper `calculateReceiptXP({ previousVisits, isFirstVisit, isNewVisitDate, distinctItems, newItems, additionalUnits })` returns the specified XP breakdown. `getCardStage(cardXP, visitCount)` returns `discovered`, `regular`, or `house_favorite`.

- [ ] Write rule tests with exact assertions: first visit with one new item = 140 XP; three previous visits plus familiar coffee/new pastry = 105 XP; quantity bonus caps at 10 before multiplication; same-day additional receipt has zero visit XP; 300 XP/2 visits stays Discovered; 300 XP/3 visits becomes Regular; 750 XP/6 visits becomes House Favorite.
- [ ] Run `npm run test:server -- progression`. Expected: failing tests before implementation, then passing tests after helpers implement the rulebook.
- [ ] Implement server validation, draft ownership, canonical names, server hashes/fingerprints, and atomic database acceptance. Ensure SQL scoring agrees with the pure helper through integration assertions.
- [ ] Add integration tests: replaying a submission ID returns the same receipt/reward result; a second account submitting the same receipt gets `DUPLICATE_RECEIPT`; concurrent submissions cannot double-award a new item, stage, or badge; failure before transaction completion leaves no partial XP.
- [ ] Test an already-known date awards purchase progress without increasing visit count. Test an unknown or foreign-owned draft returns a safe error and changes no progression.
- [ ] Prevent direct client XP writes through RLS/column privileges and verify restricted RPCs are unavailable to ordinary users.
- [ ] Run `npm run test:server` against an isolated test database and `npm run typecheck`. Manually verify persisted progress after closing and reopening the app. Commit.

### Task 4 — Collection, card detail, and milestone reveal

**Files:** `mobile/src/features/cards/*` including `themes.ts` and `stageStyles.ts`; `mobile/app/(tabs)/collection.tsx`; `mobile/app/card/[id].tsx`; `mobile/app/reveal/[eventId].tsx`; `mobile/src/assets/cards/*`; `mobile/src/assets/fonts/*`; reward-viewed backend route.

**Interfaces:** Consumes persisted card/restaurant data, `RestaurantTheme`, and `ProgressionResult`; `resolveRestaurantTheme(category, overrides)` resolves presentation defaults. Reveal uses `revealEventId` and marks that event viewed only after completion/skip.

- [ ] Build one reusable card layout and three shared stage treatments. Bundle four licensed font families and a small optional pattern/icon set. Keep restaurant name, rating, stage, and progress legible on a phone.
- [ ] Manually select primary/accent colors, a font key, and one available logo/storefront/food image for each of the five demo restaurants. Record source/permission information alongside prepared assets.
- [ ] Implement category defaults and the neutral fallback in `themes.ts`; missing image uses the category/icon background, missing font uses the bundled default. Confirm two restaurant themes look distinct in the same layout without custom per-restaurant components.
- [ ] Build collection empty/loading/error states, sorting, and card detail with visits, dishes, chosen favorite order, next stage conditions, and last visit.
- [ ] Build a short opening sequence: sealed card, tap, reveal, reward summary. Use Reanimated and restrained haptics; provide skip and reduced-motion behavior.
- [ ] Add ordinary scan progress summaries without pretending every receipt unlocked a new card.
- [ ] Preload restaurant imagery, fonts, and reusable frame assets. On missing imagery, show a themed fallback card with the correct restaurant/stage rather than blocking earned rewards. Changing stage preserves the same restaurant image and name font.
- [ ] Verify first opening, Regular evolution, highest-stage behavior, multi-stage result, interrupted opening recovery, and replay with unchanged XP. Check sorting treats unrated separately from zero-star ratings.
- [ ] Run type checking and phone QA. Commit when this completes the end-to-end live demo loop.

### Task 5 — Profile, ratings, review badges, and titles

**Files:** `mobile/src/features/profile/*`; `mobile/app/(tabs)/profile.tsx`; card review UI; review backend route; review award migration; `server/tests/reviews.integration.test.ts`.

**Interfaces:** Consumes profiles, owned cards, badge/title awards, and review data. Produces `PATCH /api/reviews/:restaurantId`, validated title equipment, three profile pins, and review-derived account rewards.

- [ ] Write integration tests: 0 and 4.5 are valid ratings, 5.5 and 4.2 are invalid; blank text awards no review badge; first nonblank review awards First Impressions once; editing it awards nothing again; rating a locked restaurant is rejected.
- [ ] Run `npm run test:server -- reviews`. Expected: behavior tests fail before implementation and pass after the transactional review path is added.
- [ ] Build rating and optional review editor, including explicit clearing of a rating back to null. Build favorite-order selection using the user's purchased dishes.
- [ ] Implement profile pins restricted to owned cards, selected avatar, name, account progress, badges, and title selection restricted to unlocked titles.
- [ ] Implement exactly the account rules and badge thresholds above. Repeated saves, refreshes, and direct mobile requests must not award twice or equip a locked title.
- [ ] Verify an XP-granting review badge updates the account level/title UI, a negative review earns identical writing recognition, and pins remain independent of ratings.
- [ ] Run server tests, type checking, and phone QA. Commit.

### Task 6 — Shareable pages and GoDaddy domain

**Files:** `server/src/sharing/*`; profile/card share actions; domain configuration documentation.

**Interfaces:** Produces `GET /p/:shareToken` and the corresponding card preview route. Share tokens are random opaque values; no email or receipt identifiers in URLs.

- [ ] Build lightweight public preview pages showing display name, equipped title, pinned cards, and the selected card's approved public fields. Reuse the restaurant's image/colors/font and shared stage treatment; use prepared assets and escape user-written text.
- [ ] Test unauthenticated requests cannot retrieve receipt images, numbers, totals, private storage paths, or server secrets. A missing/invalid token returns a simple not-found page.
- [ ] Add native share-sheet actions with a preview. If image export is troublesome, ship a working link first.
- [ ] Choose a memorable project name/domain and register through the event's eligible GoDaddy Registry offer. Follow the sponsor's exact eligibility instructions; a domain from any registrar is not automatically equivalent.
- [ ] Point it to the public project/share pages and verify HTTPS and links from a different phone. Keep the working deployment URL available while DNS propagates.
- [ ] Confirm the Replit backend is published and reachable independently of an editor development session. Commit deployment/setup notes.

### Task 7 — Freeze, verify, rehearse, submit

**Files:** `docs/demo-script.md`; `docs/setup.md`; repository README; synthetic test fixtures marked as demo data; Devpost submission text.

**Interfaces:** Produces judge-ready run instructions, demo access, recorded video, and prize integration explanations.

- [ ] Freeze features with at least 15% of the remaining time available. Fix blockers and visual issues only.
- [ ] Run `npm run typecheck`, `npm run test:server`, and mobile `npx expo-doctor`. Record results and resolve relevant failures.
- [ ] Run the full required demo on a physical phone against the published backend with a fresh account.
- [ ] Test offline upload, AI timeout, denied camera permission, duplicate receipt, expired session, double submit, interrupted reveal, and restart after acceptance. Each should preserve consistent progression and provide a recovery path.
- [ ] Prepare clearly labeled historical sample receipts for different visit dates if needed to show evolution. Include at least one real receipt extraction in the live/recorded demo. Do not silently bypass the same-day visit rule.
- [ ] Rehearse a 60–90 second pitch: dining memories are scattered; receipts become a personal collection; variety and loyalty grow it; ratings and favorite orders make sharing useful.
- [ ] Capture a short working demo video and backup screenshots. Have a team device ready for hands-on judging; document the actual installation/opening method.
- [ ] Submit Creative as the one main track. Describe Gemini's actual runtime use. Submit the GoDaddy side quest only after the eligible domain is working.
- [ ] Provide public repository, README, working links or run instructions, team roster, demo video, actual technologies used, and disclosures of pre-existing components. Keep links available through judging.

## 7. Review focus

These conditions must be covered by the owning tasks, not left as generic “edge cases”:

1. **Two submissions race:** one accepted receipt or one new dish must not award twice. Task 3 integration tests.
2. **Different wording for the same dish:** confirmed aliases merge rather than inflating menu exploration; uncertain matches remain visible. Task 2 tests and Task 3 persistence tests.
3. **Zero versus missing rating:** zero stays a real rating, while null remains unrated. Task 5 tests and Task 4 sorting QA.
4. **The app closes during a reveal:** earned progress persists and replay does not repeat rewards. Task 4 phone QA.
5. **A shared link is opened without login:** approved profile/card content loads while receipts and private fields remain inaccessible. Task 6 route tests.

## 8. Cut order if time gets tight

Cut in this order:

1. Image-based sharing; keep links.
2. Fancy effects, extra patterns, and sound; keep the shared card template, restaurant colors/font/image, and one smooth reveal with haptics.
3. Extra catalog restaurants; keep three polished examples with the full progression rules.
4. Extra profile statistics and badge presentation polish; keep the actual unlock rules.
5. GoDaddy integration if setup stalls; core demo and Gemini come first.

Do not cut duplicate checks, persisted accounts/cards, confirmation, transactional rewards, error recovery, or a real receipt-to-card flow. Do not replace functioning features with unlabeled fake buttons.

## 9. Initial Replit prompt

Copy this prompt into Replit after the team reviews the defaults above. Give Replit this entire document as the specification, but ask it to complete Task 1 before generating all later features.

```text
Build the initial scaffold for Foodie Cards, an Expo React Native mobile app with TypeScript and Expo Router, plus a Node.js/Express TypeScript backend. This is a Hacklanta project; prioritize a runnable mobile flow and a coherent, polished interface.

Use Supabase exclusively for email/password authentication, PostgreSQL application data, and private receipt storage. Do not create a Replit database, use Replit Auth, or add another auth/database provider. Use the Expo template's supported dependency versions and expo install for native packages.

Use one repository with mobile/, server/, shared/, supabase/migrations/, and docs/. Keep Gemini API calls, Supabase privileged credentials, receipt acceptance, and progression awards on the backend. Define shared Zod/TypeScript contracts before building features. The backend must derive the current user from a verified Supabase Bearer token.

First complete Task 1 from the attached plan: runnable mobile/backend projects, Supabase setup and migrations, email/password sign-in, persistent session, initial profile, protected routes, collection/scan/profile tab shells, and a backend health endpoint. Connect GitHub and document required environment variables. Use fixture cards only as clearly identified UI development data; do not award fake progress.

The eventual flow is receipt photo -> Gemini extraction -> editable confirmation -> transactional acceptance -> first restaurant-card reveal or milestone evolution -> account XP, badges, titles, personal ratings/reviews, and profile sharing. Cards are personal, not tradable. Do not build owner dashboards, chatbots, social feeds, maps, payments, or AI-generated artwork.

For card visuals, use one reusable layout with a simple theme per restaurant: primary/accent colors, one of four bundled licensed font styles, a logo/storefront/food image, and optionally one subtle pattern or category icon. Use a logo when available, otherwise storefront imagery, otherwise food imagery with a fitting restaurant-name font, otherwise a category background. Hand-pick the demo restaurants' themes; use category defaults for missing theme fields. Use prepared team-owned or permissioned images. Do not add automatic Google Places retrieval to the initial build. Upgrades reuse three shared border/shine/badge treatments while preserving the restaurant's image, colors, and font; do not create separate illustrations for every stage.

Use React Native Reanimated for milestone reveals when that task begins. Include empty, loading, retry, and error states. Never place server secrets in EXPO_PUBLIC variables. Never let the phone directly write XP or unlocks.

Stop after Task 1 runs on a physical phone and the repository has a working committed baseline. Report actual files created, Supabase setup still required, verification results, and the commands to run mobile and backend locally so external coding tools can continue.
```

## 10. Official references

- [Hacklanta tracks, sponsor challenges, and side quests](https://hacklanta.dev/)
- [Hacklanta submission requirements, prizes, and published deadline](https://hacklanta.devpost.com/)
- [Replit native mobile workflow](https://docs.replit.com/features/artifact-types/building-mobile-apps)
- [Supabase Expo integration](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Expo platform and Windows development guidance](https://docs.expo.dev/faq/)
- [Expo device setup](https://docs.expo.dev/get-started/set-up-your-environment/)
- [Expo Reanimated integration](https://docs.expo.dev/versions/latest/sdk/reanimated/)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

Checked during planning on October 10, 2026. The current Expo and Replit iPhone preview instructions differ on installation/account requirements, so verify the team's real-device path before investing in features. Store publication is not required for the hackathon demo.
