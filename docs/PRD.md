# Foodie Cards — Product Requirements Document

**Audience:** Product, design, engineering, and demo teammates.

**Baseline:** Hackathon MVP, consolidated from the agreed build plan.

**Primary demo device:** Physical iPhone.

**Implementation status:** Foundation implemented; receipt-to-card features and final visual design remain to be built.

## 1. Product and problem

Dining experiences are scattered across receipts and memories. Foodie Cards turns them into a personal collection of restaurant cards: scan a receipt, confirm what you bought, and grow a card by exploring a menu and returning to a restaurant. Ratings, favorite dishes, and pinned cards make the collection a personal food journal.

The initial audience is diners exploring Atlanta and returning to favorite restaurants. The MVP supports five curated restaurant locations. A card represents a user's experience at one location; its stage reflects dining activity, while its star rating reflects personal preference.

## 2. Goal and definition of success

Deliver a polished, persisted receipt-to-card loop on the team's iPhone against a phone-reachable backend. Gemini must process a real receipt at runtime. The user must understand what was extracted, what they confirmed, and why they earned each reward.

The required demo is:

1. Create an email/password account with a display name and bundled avatar.
2. Photograph a receipt or select one from the library.
3. See Gemini's restaurant, local date, receipt number when present, total/currency, and purchased items.
4. Correct and confirm the supported restaurant, date, items, and quantities.
5. Submit and reveal the first restaurant card.
6. Submit a later receipt and see the earned-XP breakdown.
7. Reach a stage milestone and reveal the evolved version of the same card.
8. See account progress, unlock a title, and equip it.
9. Rate/review the restaurant and pin the owned card to the profile.
10. Share a previewed card or profile link containing only approved public fields.

Success requires persisted results after relaunch, duplicate rejection, safe retry/double-submit behavior, recoverable interrupted reveals, and no cross-account private-data access. A first working receipt → acceptance → card loop takes priority over secondary features.

## 3. Scope and priorities

| Priority | Required capability |
|---|---|
| Core loop first | Accounts, private receipt upload, real Gemini extraction, editable confirmation, supported-restaurant matching, transactional acceptance, duplicate protection, persistent cards/XP, collection/detail, milestone reveal |
| Complete MVP | Personal ratings/reviews, favorite-order selection, three profile pins, account levels, badges, title equipment, public preview links and native sharing |
| Optional polish/side quest | Image-based sharing, extra motion/patterns/sound, additional catalog entries, GoDaddy domain integration |

Out of scope: trading, random draws, battles, marketplaces, friends/feeds, maps, live restaurant search, public rating aggregates, recommendations, notifications, payments, coupons, owner dashboards, receipt splitting, automatic Google Places imagery, and AI-generated card artwork.

The demo catalog is Busy Bee, Fox Bros, Mary Mac's, The Varsity, and Antico, using the seeded locations. Menu aliases are a curated matching catalog, not live prices or a complete menu. Higher-count badges remain future goals; do not fabricate activity to demonstrate them. The current catalog cannot demonstrate the three-café badge.

## 4. Experience requirements

| Surface | User-facing requirements |
|---|---|
| Authentication | Signup, email-confirmation guidance when required, sign-in, restored sessions, clear errors, sign-out, and safe account switching |
| Scan | Camera and library options; denied camera permission offers library upload; visible upload/extraction progress and retry |
| Confirmation | Editable supported restaurant/date/items/quantities; original receipt text beside normalized names; uncertainty visible; remove misread lines; no client-calculated rewards |
| Collection | Real owned cards; empty/loading/error/retry states; sort by rating, card XP, or last visit; unrated follows rated |
| Card detail | Restaurant identity, personal rating, stage, XP and visit requirements, purchased dishes, favorite order, last visit, and dining history |
| Reveal | Short sealed-card → tap → reveal → reward-summary flow; skip and reduced motion; ordinary receipts receive an XP summary without an invented milestone |
| Profile | Name/avatar, account level/progress, equipped title, up to three owned pins, collection, badges, restaurant/visit/dish counts |
| Sharing | Preview before sharing; opaque public link; approved profile/card content only; invalid links show not found |

Uploads accept JPEG, PNG, or WebP up to 10 MB. Resize/compress captures before upload; conversion failure offers another upload. Extraction has a 30-second timeout and at most one automatic retry for transient failure; retrying extraction never awards progress. Preserve user edits on recoverable failures where possible.

## 5. Visual requirements

The current foundation preview is a scaffold, not the approved finished design. The design/cards owner establishes the visual direction with a collection screen and one restaurant card for team review before expanding it to the remaining screens. Use the Expo design-system, native-UI, and animation skills to guide implementation.

Use one reusable card layout with manually selected restaurant colors, one of four bundled licensed font styles, permissioned logo/storefront/food imagery, and an optional subtle pattern. Keep the actual restaurant name, rating, stage, and progress legible. Missing imagery falls back to a category background/icon; missing theme data uses category or neutral defaults.

Three shared stage treatments preserve restaurant identity: Discovered uses a clean frame; Regular adds a richer border/accent; House Favorite adds a premium border, restrained shine, and title ribbon. Preload prepared assets; earned-card reveals cannot depend on runtime image retrieval/generation. Native controls, deliberate typography/spacing, accessible contrast, restrained haptics, and reduced-motion behavior apply across screens.

## 6. Receipt and progression rules

Gemini proposes extraction; deterministic backend/database rules decide rewards. Missing essential information requests a clearer image. Unsupported restaurants award nothing. Unknown/uncertain item matches stay visible for correction. Missing quantity defaults to one; merge duplicate normalized dish lines. Tax, tip, service fees, discounts, and payment lines earn no food XP.

A receipt can be accepted once across the app. Check image hash and a fingerprint containing restaurant, local date, receipt number when present, total/currency, and sorted item/quantity pairs. Ambiguous collisions explain that the receipt appears already submitted; do not claim proven fraud. The submitting account receives credit, and corrections cannot transfer an accepted receipt's ownership.

Multiple unique receipts at one restaurant on one local date count as one visit; later same-day receipts may earn purchase XP but no further visit bonus. New-item rewards occur once per user/restaurant/item.

| Card-XP component | Award |
|---|---:|
| First distinct visit date | 100 |
| Later distinct visit date | 50 |
| Each distinct normalized item on the receipt | 10 |
| Each item never purchased here before | Additional 30 |
| Units beyond the first of each item | 2 each, capped at 10 across the receipt |

Purchase XP uses a multiplier based on distinct visits completed before this receipt: 0–2 visits = 1.0×; 3–5 = 1.1×; 6–9 = 1.2×; 10+ = 1.3×. Visit XP is not multiplied.

`purchaseBase = 10 * distinctItems + 30 * newItems + min(10, 2 * additionalUnits)`

`receiptXP = visitBonus + floor(purchaseBase * veteranMultiplier)`

Examples: first visit with one new item earns 140 card XP. A new-date visit after three previous visits, with one familiar coffee and one new pastry, earns 105 card XP.

| Card stage | Both requirements where applicable | Account-XP award, once |
|---|---|---:|
| Discovered | First accepted receipt | 100 |
| Regular | At least 300 card XP and 3 distinct visit dates | 150 |
| House Favorite | At least 750 card XP and 6 distinct visit dates | 300 |

Crossed unearned stages each award once; show one reveal for the highest stage and list all rewards. Card XP continues at the highest stage. Show XP and visit goals separately. Reveal event IDs support recovery; replay never awards XP, and viewed status is recorded only after completion or explicit skip.

## 7. Account, reviews, badges, and titles

`accountLevel = 1 + floor(accountXP / 200)`. Account XP comes from stage awards and first-time badges. Every badge awards 50 account XP once; titles grant no XP. Evaluate badges before title unlocks. Unlocks remain permanent even if a review is deleted.

| Badge | Requirement | Associated title |
|---|---|---|
| First Bite | First restaurant card | None |
| Café Crawler | Three different café cards | Café Crawler |
| Menu Explorer | Ten distinct restaurant/item combinations purchased | Menu Explorer |
| Loyal Regular | One House Favorite card | Loyal Regular |
| First Impressions | One restaurant with a written review | None |
| Food Critic | Ten restaurants with written reviews | Food Critic |
| Seasoned Reviewer | Twenty-five restaurants with written reviews | Seasoned Reviewer |
| Critic's Club | Fifty restaurants with written reviews | Critic's Club |

Additional titles: Ultra Foodie at account level 5; Mega Food Crawler at twenty restaurant cards. Equip only unlocked titles.

Ratings are 0–5 in half-star increments; zero is valid and null means unrated. Reviews are optional, at most 500 characters, and require an unlocked card. Whitespace-only text earns no review badge; edits never count as additional restaurants reviewed. Stars alone earn no review badge; neither stars nor review text earns card XP. Negative reviews receive identical writing recognition. Pins are up to three distinct owned cards, independent of rating or XP. Favorite-order selection uses purchased dishes.

## 8. Trust, privacy, and reliability

Supabase owns accounts, PostgreSQL data, and private receipt storage. Expo is the mobile client; the TypeScript/Express backend calls Gemini and verifies Supabase bearer tokens. Replit is excluded from this workflow; use the existing Express backend. Gemini and Supabase service-role keys stay server-side.

Receipt acceptance and receipt/review rewards are atomic and idempotent. Clients cannot directly award XP, stages, badges, or titles. Concurrent submissions must not double-award a receipt, new item, stage, or badge. Failed transactions leave no partial progress. Unknown or foreign-owned drafts fail safely.

Private data and receipt files are owner-scoped through RLS/storage policies. Public links contain no email, receipt identifiers/images/numbers/totals, storage paths, or secrets. Escape user-authored public text. This is not merchant-backed verification; do not describe receipt checking as fraud-proof.

Exercise offline upload, AI timeout, denied camera permission, duplicate receipt, expired session, double submit, interrupted reveal, and restart after acceptance. Fixtures must be labeled development/demo data and must never masquerade as live earned progress.

## 9. Team ownership and delivery order

Current assignment: the project owner takes **A**, one teammate takes **B + C**, and one teammate takes **D**. B and C remain separate responsibility lanes under the same person.

| Lane | Immediate assignment | First deliverable |
|---|---|---|
| A: integration owner | Transactional acceptance/progression, duplicate protection, receipt/review awards, deployment, shared contracts/migrations/dependencies | Real receipt creates persisted card/XP exactly once, with replay/concurrency tests |
| B: receipts/AI | Capture/upload, Gemini extraction, normalization, editable confirmation | Three real receipts produce valid editable drafts with uncertainty/error recovery |
| C: design/cards | Visual direction, restaurant assets/themes, reusable card, collection/detail, reveal | Team-reviewed collection/card design, then first-unlock/evolution fixtures on iPhone |
| D: profile/sharing | Profile, rating/review mobile UI, pins, titles; sharing after core loop | Contract-shaped profile/editor states, followed by persisted data and transactional review awards |

Assign a foundation-QA owner immediately for iPhone signup/confirmation/sign-in/relaunch/sign-out/account switch, backend access, and authenticated two-user privacy checks. B/C/D can work against agreed contracts and labeled fixtures while QA and A proceed. First connect B → A → C; then integrate D. With two feature teammates, prioritize B and C.

Each owner branches from current `main`, uses explicit file ownership, and submits small PRs with verification and dependencies. A controls shared contracts, migrations, root dependencies, and lockfiles. C and D coordinate card-detail/review placement; D calls A's transactional review-award function. See [team workflow](team-workflow.md#assignments-to-start-now) for working boundaries.

## 10. Current state and release gate

Implemented: Expo authentication/tab shells, reusable basic UI/theme, Express health/authenticated profile APIs, shared Zod contracts/labeled fixtures, hosted Supabase schema/private storage/catalog. Automated foundation checks passed; actual phone auth/session checks and authenticated two-user hosted tests remain pending. Gemini variables are configured locally; model/API access and extraction accuracy remain unverified. Public backend deployment and completed visual design are pending.

Do not treat defined contracts as implemented endpoints. Lane A's feature branch implements atomic rewards, review/profile APIs, and reveal recovery with local verification. Receipt extraction, final card/reveal UI, full profile UI, and sharing remain feature work. [Checkpoint handoff](checkpoint-handoff.md) records branch, deployment evidence, and limitations.

Before demo release: run applicable tests/typecheck/Expo Doctor, exercise the complete flow on a fresh account against the published backend, verify recovery/privacy, rehearse a 60–90 second pitch, and prepare a video/screenshots backup. Include at least one real receipt extraction; historical sample receipts may demonstrate later visit dates only when clearly labeled. Freeze features with at least 15% of the remaining time for verification/rehearsal.

If time is short, cut image sharing, decorative effects, extra restaurants (keep three polished examples), extra profile statistics, then the domain side quest. Preserve confirmation, duplicate checks, persisted accounts/cards, transactional rewards, error recovery, and a real receipt-to-card loop.

## References and change control

- [Build plan](foodie-cards-plan.md): detailed product rules, architecture, task-level tests, and implementation sequence.
- [Team workflow](team-workflow.md): lane boundaries and integration process.
- [Checkpoint handoff](checkpoint-handoff.md): actual implementation status and verification.
- [Foundation interfaces](foundation-handoff.md) and [shared contracts](../shared/contracts.ts): implementation interfaces.
- [Setup](setup.md): local environment and phone/backend setup.

This PRD restates the agreed product scope; it does not introduce new features. Product changes must update this PRD and the corresponding build-plan rules together; route/schema changes also update shared contracts through A. Implementation status belongs in the checkpoint handoff, not inferred from unchecked historical plan checkboxes.
