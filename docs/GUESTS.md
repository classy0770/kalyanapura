# Guest management

Implemented at `/dashboard/guests`: real empty state, guest creation, details, version-protected editing, event assignments, optional contacts/organiser notes, name-prefix search, RSVP/event filters and bounded pagination. The dashboard guest-group count comes from the current wedding's guest records, not party allocations. Directory response metrics describe the currently loaded view. `/preview/guests` remains a separate labelled fictional design prototype.

Guests represent an invitation group. Names, emails and phone numbers are not unique identities; shared contacts are allowed. New records have `pending` RSVP, zero attending people and a default maximum party size of one. Events can be assigned later. Only active Admins and Managers in the authenticated account's current wedding can access these APIs. Each mutation writes the wedding coordination fence, rechecks live authority and references, then changes the guest in a short snapshot/majority transaction. No provider call occurs within a transaction.

## Configuration and storage

`GUEST_MAX_PARTY_SIZE` defaults to 20 and supports integers 1–100. This is a configurable technical input safeguard, not a subscription or guest-list quota. Event assignments allow up to 100 unique active events in the same wedding. Invalid configuration fails when the capability is used.

Guest creation uses the existing `WEDDING_GALLERY_ENCRYPTION_KEY` as the version `v1` wedding capability encryption key. No new credential is needed if wedding creation is configured. The random invitation token is 32 bytes encoded as base64url, indexed by its SHA-256 digest and retained under AES-256-GCM with a fresh nonce and associated data `guests:{guestId}:invitation:1`. The collection/record/purpose/version binding separates it from gallery ciphertexts. Ordinary guest projections exclude bearer material; the dedicated authorised invitation-link endpoint returns the shareable URL. Back up this key with the database; future rotation must handle both gallery and guest envelopes. Copy-link and guest access are documented in `docs/INVITATIONS.md`; invitation delivery remains deferred.

## API subset

- `GET /api/v1/weddings/{weddingId}/guests`: safe organiser projection, `q` normalized escaped name prefix (maximum 150 input characters), `rsvpStatus`, `eventId`, `limit` (default 25, maximum 100) and opaque signed `cursor`. Sort by normalized name and ID; cursors bind to wedding and filters using a key domain-separated from the Better Auth secret.
- `POST /api/v1/weddings/{weddingId}/guests`: required `name`; optional `email`, `phone`, `maxPartySize`, `invitedEventIds`, `notes`; 201 with Location and resource version. Creates stored invitation metadata without sending anything.
- `GET /api/v1/weddings/{weddingId}/guests/{guestId}`: safe guest detail and version.
- `PATCH /api/v1/weddings/{weddingId}/guests/{guestId}`: the same editable guest fields, with `X-Expected-Version`; missing/invalid/stale versions produce 428/400/412. Lowering the maximum below current attendance returns `409 RSVP_LIMIT_CONFLICT`. Attending count is never silently reduced. Explicit RSVP correction while lowering an allocation is supported atomically; use the dedicated RSVP endpoint for other corrections.

All responses carry request IDs and private/no-store headers. Product mutations require configured Origin, JSON and `X-KP-Request: 1`. Stored documents are explicitly projected, including safe invitation metadata and own-record RSVP metadata but excluding internal fields and bearer material.

An uncertain browser save blocks another submission until “Check saved guests” successfully reloads all list pages and displays saved records for review. The UI does not replay a POST automatically. A stale edit requires explicit reload of the latest guest details before resubmission.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm run check:contracts`, `npm run check:guests`, and `npm run check:guests:browser`. Integration/browser checks use synthetic accounts and an isolated local replica set, never Atlas or provider delivery. Browser checks require existing Playwright tooling via `PLAYWRIGHT_MODULE_PATH` if needed, and an installed channel such as `PLAYWRIGHT_CHANNEL=msedge`. Optional `SMOKE_SCREENSHOT_DIR` stores QA screenshots.

Personal invitation sharing and access are implemented; see `docs/INVITATIONS.md`. Guest RSVP collection is implemented; see `docs/RSVP.md`. CSV import is implemented; see docs/GUEST_IMPORT.md. Delivery, guest deletion, messaging and event cascade deletion are future increments. A local isolated pass does not verify live Atlas configuration or those workflows.

## Invitation and RSVP design preview

`/preview/invitation` presents a fictional personal invitation based on Stitch screen `721d42223bb04ebd85602665ffe01ee7` in the existing KalyanaPura project. It includes invited celebrations, external Maps directions, one overall RSVP, a 1–4-person allocation, and attendance/decline confirmation in browser memory only. Scenario controls show an unavailable invitation and no active invited events. It does not implement guest grants, token exchange, saved responses, gallery access or delivery. Refreshing resets the preview.

After `npm run build`, run `node scripts/invitation-preview-check.cjs` with the existing Playwright tooling configured as above. It starts and stops a local production server and checks the preview at desktop/mobile widths without product API requests.

## Verification result — 11 October 2026

| Command | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; guest collection/detail APIs and private/public guest pages generated |
| `npm run check:contracts` | Passed |
| `npm run check:guests` | Passed; includes authority revocation before the coordination write and rollback |
| `npm run check:guests:browser` | Passed at 1280px and 390px; real login, wedding/event creation, saved guest creation/reload/details/event assignment, stale edit/reload/save, filters, dashboard count and denied access after logout |
| `npm audit --omit=dev` | Passed; zero production vulnerabilities |
| `npm audit` | Failed; four previously documented high development findings in the braces dependency chain. Dependencies unchanged |
| Live Atlas guest writes, provider delivery and deferred workflows | Not run; checks use isolated synthetic data and no provider sends |

Saved guest screenshots were visually reviewed at both widths. Early browser attempts encountered local MongoDB startup/navigation timeouts; the harness now allows a longer disposable database start and waits for initial DOM readiness. A badge assertion was corrected to use text content rather than CSS-transformed uppercase inner text. Final checks passed. The scripts stopped their isolated app/browser/database processes. No commit, push or deployment was performed.
