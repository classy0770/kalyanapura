# Wedding creation and private workspace

This increment implements creation, live membership resolution, and saved wedding details/countdown. The subsequent [events increment](EVENTS.md) implements event creation, viewing, editing and the real dashboard itinerary/count. Invitations, wedding-detail editing, member administration, event deletion, tasks, guests, expenses, galleries and website publishing remain deferred. The dashboard labels their fictional samples; its coming-soon dialogs make no mutations.

## Configuration

Complete [account setup](ACCOUNT_SETUP.md) first. Keep credentials in ignored `.env.local`, never `.env.example`. Use a MongoDB replica set (Atlas meets this requirement), with permission to create application collections and indexes. No additional provider is required for wedding creation.

Set `WEDDING_GALLERY_ENCRYPTION_KEY` to an independently generated 32-byte hexadecimal secret (64 hex characters). It is validated only when creating a wedding. Existing wedding reads do not require this encryption capability. Preserve this key securely alongside database recovery material: changing it without migrating ciphertext makes stored gallery capabilities unrecoverable. The initial `v1` envelope uses AES-256-GCM and binds wedding ID/purpose/version as authenticated data; no token or ciphertext is returned to browsers.

No live infrastructure or backup policy is provisioned by this feature. Before accepting real wedding data in production, configure backups and test a restore with the necessary encryption keys, as required by the database design.

## Journey and persistence

After verified login, `/dashboard` resolves the account's current database membership. No membership redirects to `/create-wedding`; an active membership displays that wedding; a removing membership displays cleanup status. Anonymous requests redirect to `/login`. The creation form requires bride/groom names, a valid local wedding date and location, with an optional title. Blank title is sent as null.

Creation initializes `weddings` and `wedding_members` lazily, including collection validators and a unique canonical-string `userId` membership index. A bounded snapshot/majority transaction inserts the wedding, performs its coordination write and inserts the initial active Admin membership. Concurrent creates return one success and `409 ALREADY_IN_WEDDING`; failed transactions leave no orphan wedding. Existing collections are not automatically migrated or altered. Resolve conflicting legacy indexes/data through an explicitly reviewed migration before using this increment against such a database.

Website defaults are unpublished, and media quota starts at zero (uploads blocked). Stored gallery toggles are defaults for future capability workflows; there are no gallery routes or upload adapters in this increment. The private dashboard does not publish a website or grant guest access.

## Implemented HTTP contracts

- `GET /api/v1/me`: authoritative account, current membership or null, `nextAction`, and documented request limits.
- `POST /api/v1/weddings`: verified account without current/removing membership; JSON body with required creation fields and optional title; `201` product envelope containing `data: { wedding, membership }`, `Location` and `X-Resource-Version`.
- `GET /api/v1/weddings/{weddingId}`: live active membership must match the URL wedding; `200` with the same safe resource envelope and version header. Another wedding returns `404`.

Responses use private/no-store headers and explicit projections, including safe website/livestream settings and gallery toggles. Secrets, stored counters and bearer tokens are excluded. Creation requires exact configured Origin and `X-KP-Request: 1`, accepts JSON only, and bounds the received body to 256 KiB. A transport failure can happen after commit: check the dashboard before manually retrying; the form never automatically retries creation.

The pure UI preview moved to `/preview/create-wedding` and remains clearly fictional. It neither writes to the database nor grants private membership.

## Repeatable verification

Use Node 24 and the installed dependencies:

```sh
npm run lint
npm run typecheck
npm run build
npm run check:contracts
npm run check:accounts
npm run check:weddings
npm run check:weddings:browser
```

Wedding checks use an isolated local MongoDB replica set and synthetic verified accounts. Browser checks require existing Playwright (or `PLAYWRIGHT_MODULE_PATH`) and an installed browser (`PLAYWRIGHT_CHANNEL=msedge` on this machine). They start a disposable application copy without copying `.env` files, retain ignored generated output in the operating system temporary directory for diagnostics, and stop their own server/database/browser afterward. They do not write to Atlas or send provider email. Build/automated passes do not establish live Atlas connectivity, inbox delivery, backup restoration or future product permissions.
