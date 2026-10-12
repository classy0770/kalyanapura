# Wedding events increment

Implemented: a private `/dashboard/events` itinerary with ceremony shortcuts, creation, detail viewing and editing. The dashboard shows the saved event count and the next three upcoming events; an empty wedding shows an honest empty state. Both active Admins and Managers can use these workflows. Tasks, guests, invitations, expenses, vendors, gallery covers, calendar export/sync and event deletion remain separate future increments.

The UI adapts Stitch's **KalyanaPura - Events & Itineraries**, screen `57b2440a3651477ba6602e1d09819a77` in project `9574853340286145696`, to the existing dashboard fonts, colours, sticky navigation and mobile dialog. The source design includes other timezones, exports, budgets, rosters and example photos. Those are not implemented: V1 uses Asia/Kolkata, no budgets or invented linked totals, and no fake cover uploads.

## Configuration and dates

`WEDDING_EVENT_LIMIT` defaults to the owner's approved **25 events per wedding**. It is a positive safe integer deployment safeguard, not a paid entitlement, and is exposed as `limits.eventsPerWeddingMax` in `/api/v1/me`. Invalid configuration fails clearly when the capability is used. Existing deleting records retain a capacity slot until cleanup removes them. Capacity admission is checked under the wedding coordination write and transaction.

Start date and time are required; the form never invents midnight. The optional end has its own date so an event can cross midnight. Events may occur before or after the wedding date. REST requests use timestamps with explicit offsets, storage uses BSON Date, responses use UTC ISO timestamps and the UI displays India Standard Time. Editing preserves seconds and milliseconds in saved times.

Time entry uses minute precision, hiding seconds/milliseconds. Display text explicitly uses a 12-hour clock with AM/PM. If an existing timestamp has greater precision, changing other event fields preserves that timestamp; choosing a different time saves the chosen minute.

## REST and safety

Within `/api/v1/weddings/{weddingId}`:

- `GET /events`: active-event list with default limit 25, maximum 100; optional `public=true/false`; chronological order with ID tie-breaker. Signed opaque cursors bind to this wedding and filter. The signing key is domain-separated from the existing Better Auth secret; rotating that secret invalidates old cursors, requiring list refresh.
- `POST /events`: required `name`, `startsAt`; optional `type`, `endsAt`, `venueName`, `address`, `description`, `dressCode`, `coverPhotoId`, `isPublic`. Returns 201, Location, resource version and an explicit safe event projection. Default type is `custom`, optional fields null and website selection false. Duplicate names are allowed.
- `GET /events/{eventId}`: active, same-wedding resource and version.
- `PATCH /events/{eventId}`: strict allowlisted partial update, with exactly one positive `X-Expected-Version`. Missing/malformed/stale versions return 428/400/412. A 412 form cannot save again until the user explicitly reloads the current details. Covers must be ready event covers in the same wedding and event; this UI does not offer cover selection yet.

No delete endpoint or successful stub is added. Selecting an event for the future public website does not publish it.

Each entry resolves a verified Better Auth account and live active membership, matching the URL wedding. Every event query includes wedding scope and active status. Writes acquire the real wedding coordination increment first, then re-read current authority/targets in a bounded snapshot/majority transaction. Event business revisions change on edits; coordination alone leaves wedding version/updatedAt unchanged. Failure rolls back event and coordination writes. Collection validators and the schedule index initialize lazily outside transactions; existing collections are not automatically migrated.

Mutations reuse the product Origin/custom-header/content-type/body-size protections and sanitized HTTP errors. No credentials, internal creator IDs, coordination fields or deletion metadata are projected. GET is read-only. Creates have no generic idempotency store: a lost response can follow a successful commit, so the form asks the user to inspect saved events before manually retrying. It does not automatically repeat a POST.

## Verification

An uncertain save blocks another submission until “Check saved events” successfully reloads the REST list (including remaining pages), replaces local event/pagination state and closes the form. A failed recovery read keeps submissions blocked. Users review saved events before intentionally submitting again; no POST is automatically replayed. The browser regression commits a creation and drops its response, fails one recovery read, then delays the successful read and verifies that recovery reveals exactly one event with only one creation request.

For an uncertain save result, “Check saved events” fetches the current REST list and replaces local event/pagination state before closing the form. New submissions are blocked while the outcome is uncertain or the check is running. A failed check keeps that block in place; a successful check shows saved events for review before an intentional new submission. The browser regression commits a creation, drops its response, fails one recovery read, then verifies a delayed successful read reveals exactly one saved event without replaying the POST.

```sh
npm run lint
npm run typecheck
npm run build
npm run check:contracts
npm run check:weddings
npm run check:events
npm run check:events:browser
```

Integration checks use an isolated local replica set and synthetic member fixtures. The browser command extends the existing real Better Auth/wedding creation journey in a disposable app copy, with desktop/mobile create, view, stale edit, reload, save and persisted dashboard checks. Use existing Playwright via `PLAYWRIGHT_MODULE_PATH` and an installed browser via `PLAYWRIGHT_CHANNEL` if necessary; no tool is installed by the script. Optional `SMOKE_SCREENSHOT_DIR` stores local QA images. Tests stop their own processes and never connect to Atlas or send provider mail.

Production backup/restore and encryption-key requirements from [WEDDING_SETUP.md](WEDDING_SETUP.md) still apply. A build or isolated pass does not verify live Atlas, provider delivery, deletion/cascade permissions or unimplemented domain workflows.

## Verification result — 10 October 2026

Lint, type checking, production build, contract regressions, account regressions, wedding regressions, event integration checks and event browser checks passed with Node 24. Production HTTP and desktop/mobile smoke checks passed at port 3101, with live database access disabled; the temporary server was stopped. The 1280/390px event journey verified real login and wedding creation, empty state, event persistence across reload, cross-midnight times, detail view, stale edit rejection, explicit reload before save, updated dashboard count/itinerary and denied private access after logout. Screenshots were visually reviewed.

Initial test setup/locator errors were corrected: source-loader fixtures now share the same error constructors as extracted HTTP helpers, the event-type locator handles its native select label, and generated app copies use the OS temporary directory rather than production output or dependency cache. Final checks passed; no temporary application credentials or provider calls touched live services.

`npm audit --omit=dev` passed with zero production vulnerabilities. The separate full audit failed with the four previously documented high development findings in the braces chain; dependencies were not changed. Live Atlas event writes, real providers, production backup restoration and deferred workflows were not run. No commit, push or deployment was performed.
