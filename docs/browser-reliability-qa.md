# Browser reliability fixes — October 11, 2026

## Changes

- The API handles browser preflights before authentication and JSON parsing. `CORS_ALLOWED_ORIGINS` contains exact HTTP(S) origins; no wildcard or cookie credentials are enabled. Actual private requests still require a verified bearer token.
- Web receipt preparation validates a real image Blob and submits it with a multipart filename. Native image preparation and URI multipart uploads retain their existing behavior.
- Private card and reveal routes wait for auth hydration, then redirect signed-out users to sign-in. Development demo reveals remain available only in development. Signing in currently opens the collection rather than resuming the original deep link.
- Completed reveals are marked handled only after a successful, validated server acknowledgement. Failed or timed-out saves keep the event pending and expose a retry control alongside the completed card.

Configure the backend with `CORS_ALLOWED_ORIGINS=http://localhost:8082` for this QA instance. Configure the actual deployed web origin separately for deployment; the allowlist is not inferred from client requests.

## Verification

The browser used `http://localhost:8082`, the API used `http://localhost:3001`, and auth/database/storage used local Supabase. Gemini used the supplied server configuration. Hosted data and configuration were not changed.

| Check | Result |
| --- | --- |
| Automated tests | 294 tests passed across 32 files; baseline was 270 tests. |
| TypeScript | Full shared/server/mobile typecheck passed. |
| Independent Luna reviews | No material blockers found in the combined changes. |
| Allowed-origin preflight | HTTP 204 without a bearer token; exact allow-origin plus Authorization/Content-Type headers. |
| Disallowed-origin preflight | HTTP 403 with no allow-origin header. |
| Actual request without credentials | HTTP 401 despite having an allowed Origin. |
| Browser API connection | Collection loads without the previous backend-unavailable warning. |
| Real receipt uploads | All three supplied image copies passed ImagePicker → ImageManipulator → Blob multipart → live Gemini → private saved draft → editable browser confirmation. Totals displayed: $6.84, $102.36, $64.72. |
| Unsupported receipt protection | No supported restaurant was automatically selected for these receipts. Confirmation without a selection shows an error and preserves edits. The real samples were not accepted or used to award progress. |
| Confirmation recovery | A clearly labeled synthetic local draft retained an edited quantity after an API outage. Retrying after restoration accepted it and displayed 48 earned XP. SQL confirmed accepted status and 838 card XP / 7 visits. |
| Acceptance reload | Reloading the accepted draft returns not found; it cannot be accepted again through that confirmation page. Automated acceptance tests cover replay and duplicate behavior. |
| Reveal save recovery | Stopping the API before explicit skip produced a retry error while the completed card stayed visible. Restoring the API and retrying saved `viewed_at`, confirmed with SQL. |
| Signed-out private links | At the separate `127.0.0.1:8082` origin, both private card and reveal links redirected to sign-in instead of loading indefinitely. The localhost QA session remained intact. |
| Development demo | A signed-out demo reveal remained labeled synthetic and completed without awarding persisted XP. |

The receipt copies and real extraction drafts remain in the local QA environment. Acceptance data is explicitly synthetic, and the originals in `C:\Documents\receipts` were not changed.

## Remaining work

Physical-phone camera/location/haptics and hosted deployment were not reverified here. Gemini fields remain editable; matching displayed totals does not establish perfect extraction of every field. The initial verification above preceded Lane D; review/profile editors, pins, titles, and badges are now present. Sharing, favorite-order selection/persistence, deep-link return after sign-in, and the complete reward breakdown remain pending.

## Lane D integration follow-up

Merged the updated main (PR #5) into the browser reliability branch, preserving both the private card guard and the review editor. Pushed the integration as `2c73aee`, then pulled main back into the working branch.

Browser checks use only the synthetic local Browser QA account:

- Saved a written review with a zero-star rating; the card and profile history display zero rather than unrated. Updated it to 4.5 stars successfully.
- The first written review awarded First Impressions and exactly 50 account XP: 750 became 800, reaching level 5 and unlocking Ultra Foodie. Editing the review retained 800 XP.
- Changed the display name and selected Taco; the updated identity appeared on the profile.
- Saved two owned cards in pin slots 1 and 2 and reloaded the customization page successfully.
- Reproduced title-save loss of unsaved pin rearrangements and profile-save navigation returning to Map. Both stemmed from clearing the authenticated profile during a refresh, unmounting screens/navigation.
- Added regression coverage for review PATCH preflights and edit/customize profile-error routing.
- After the refresh fix, saving a title preserved the unsaved swapped pins; saving those pins persisted the new order. Profile editing returned to the Profile tab with the new name, Taco avatar, Ultra Foodie title, review history, and unchanged 800 account XP.
- A latest-session check rejects delayed refresh callbacks from a previous account before they can change the active session scope. Initial loading and profile-error retries still hide profile data until loaded.

The combined follow-up suite passes 336 tests across 39 files. Full shared/server/mobile typechecking passes. Independent Luna review and browser reload confirmed the profile, title, pin order, and review persisted.

The remaining functionality gaps above are separate planned work, not evidence that every PRD feature is complete.
