# Some concerns

These concerns come from a review of the Foodie Cards planning baseline at commit `7856de3`. At the time of review, the local checkout contained planning documents rather than application code, so these are design gaps, not confirmed runtime bugs. Later foundation and feature changes have not been checked against these concerns; reassess them against the current implementation before treating them as unresolved.

All three are **P2 (medium priority)**: worth resolving before dependent implementation, but not urgent blockers. The usual review scale is P0 (critical), P1 (high), P2 (normal), and P3 (low).

## 1. Unknown dishes need an acceptance policy

The [essential data model](foodie-cards-plan.md#essential-data-model) stores canonical menu-item IDs on receipt items and purchased-item records. The [shared contracts](foodie-cards-plan.md#shared-contracts), however, accept confirmed dish names, and normalization can leave items unresolved.

If a user confirms a legitimate dish absent from the seeded menu, the plan does not say whether acceptance creates a canonical item, requires selection of an existing item, excludes the dish from item XP, or rejects the submission. Inconsistent identities could repeatedly award new-item XP or distort the Menu Explorer badge count.

**Resolution needed:** Define how unresolved or corrected names become stable restaurant-specific item identities, including whether they earn XP. Test an unseeded dish and a later receipt using an alias for that same dish.

## 2. Favorite orders need persistence and an interface

[Tasks 4 and 5](foodie-cards-plan.md#task-5--profile-ratings-review-badges-and-titles) require displaying and selecting a favorite order from the user's purchased dishes. The essential data model and network boundaries do not specify a stored preference or a read/write interface for it.

A selection could be lost after relaunch or implemented differently by the cards and profile lanes.

**Resolution needed:** Define a persisted favorite-order preference per user and restaurant, restricted to that user's purchased dishes. Include its read/write contract in the foundation handoff and verify that the selection survives relaunch.

## 3. Multi-stage summaries need explicit reward data

The [card-stage rules](foodie-cards-plan.md#card-stages-and-openings) require awarding every crossed stage exactly once, showing one opening of the highest stage, and listing all rewards. `ProgressionResult` currently exposes only the final stage and one nullable reveal event ID.

If one receipt crosses Regular and House Favorite, that response alone does not identify both stage awards. Reward-event payloads could supply the information, but their retrieval and shape are not defined for this summary.

**Resolution needed:** Define either a stage-award list in `ProgressionResult` or an explicit retrievable reveal payload containing all crossed stages and their account XP awards. Keep one highest-stage opening, and test that interrupted recovery and replay show the same summary without awarding XP again.

## Review limits

The review used three Luna agents, with findings checked by the coordinating agent. No implementation changes were made. Runtime correctness, security, and test results could not be assessed because no application or runnable test suite existed in the reviewed baseline.
