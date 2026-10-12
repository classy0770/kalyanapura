# Personal invitation links

Members open guest details under `/dashboard/guests` and load the personal invitation controls. They can copy the canonical link, open a manual WhatsApp composer, disable/enable the invitation, or explicitly replace its link. No message is sent by the application. Confirmation is required for disable/enable/replacement. Stale revisions require a reload; an uncertain replacement must be checked through the read-only link endpoint before retrying.

## Security and persistence

Admin/Manager authority and the account's live wedding membership are enforced on every member endpoint. Changes reuse the wedding coordination write and short transaction, check `X-Expected-Version`, and increment the guest resource revision. Replacement rotates a 32-byte random token and its token version; its SHA-256 digest is indexed for lookup. The original link remains stable through ordinary guest edits. Disabling does not rotate the token, and enabling deliberately restores the same link. A replacement retains the current enabled/disabled setting.

The retained token uses the existing `WEDDING_GALLERY_ENCRYPTION_KEY` and AES-256-GCM envelope with guest ID and token version as associated data. Guest access cookies use a separate HMAC-derived encryption key and purpose from this same root key, with a `v1` envelope. Keep this key stable and backed up separately from the database; changing it invalidates existing derived access and requires a planned token-envelope migration to retain links. No new credentials are required for this increment.

`/invite/{token}` is a minimal first-party entry page. It replaces the token-bearing history entry with `/invitation` before the guest clicks **Open my invitation**. Opening the page alone changes no product records and exchanges no token. The POST exchange sets an encrypted, authenticated, HttpOnly, SameSite=Lax, seven-day cookie. HTTPS origins use `__Host-kp-guest`, Secure, Path=/ and no Domain; local HTTP development uses `kp-guest`. Missing, expired or malformed access returns 401. Disabled/replaced/deleted invitations return generic 404. The cookie is distinct from member authentication and cannot authorise member APIs. Closing guest access clears only this browser's guest cookie; the invitation itself stays usable.

Every invitation read rechecks the live guest, enabled state, captured token version and active wedding. Event reads are scoped to that wedding and the guest's active invited events. Contact information, organiser notes/identity, other guests, token material and private wedding settings are never projected. Cross-wedding or deleting events are excluded. Wedding dates do not expire links. Entry and invitation pages use no-referrer, no-store and noindex headers; Next.js request logs ignore token entry paths and access requests. Any external hosting/analytics access logs must likewise redact token-bearing paths and cookie/body credentials before deployment.

## Endpoints

- `GET /api/v1/weddings/{weddingId}/guests/{guestId}/invitation-link`
- `PATCH /api/v1/weddings/{weddingId}/guests/{guestId}/invitation` with `{enabled}`
- `POST /api/v1/weddings/{weddingId}/guests/{guestId}/invitation/replace` with an empty JSON request (an empty body or `{}`)
- `POST /api/v1/guest/access` with `{source: "invitation", token}`
- `DELETE /api/v1/guest/access` with an empty JSON request
- `GET /api/v1/guest/invitation`

Mutations/exchanges require the configured Origin, `X-KP-Request: 1` and JSON content type. GETs are read-only; member link responses are private/no-store and bearer links appear only in the dedicated link projection.

Guest exchange has atomic fixed-window admission: 60 attempts per minute per trusted IP (or a shared local bucket when `AUTH_TRUSTED_IP_HEADER` is unset), and 20 per token. The trusted header must be stripped/overwritten by the hosting proxy, as for member authentication. Subjects are HMAC-hashed; raw IPs/tokens are never stored. `rate_limits` adds the documented product bucket fields, plus the same-valued adapter `key` for compatibility with Better Auth's existing unique index. Its product `bucketKey` index is partial so auth-owned rows remain valid. Expired product buckets have a one-hour cleanup margin; admission checks server time and counters rather than TTL cleanup. Exhaustion returns 429 with Retry-After.

## Current scope and checks

`/invitation` renders real wedding presentation and invited-event details using the approved preview style. Saved guest RSVP is implemented; see `docs/RSVP.md`. `canRespond` is true for a valid invitation even without events, while `canAttend` indicates whether active invited events remain. Covers/media, gallery access, shared gallery grants, embedded livestream playback, email sending remains deferred. `canViewGallery` and `canUploadPhotos` remain false. The fictional `/preview/invitation` is unchanged in purpose.

Run `npm run check:invitations`, `npm run check:guests`, `npm run check:invitations:browser`, `npm run check:contracts`, `npm run lint`, `npm run typecheck` and `npm run build`. `check:guests:browser` also runs the full event editing journey before the guest and invitation checks. Database/browser regressions use disposable local replica sets and synthetic members; they do not send messages or touch Atlas. Browser tooling is configured as described in `docs/GUESTS.md`.
