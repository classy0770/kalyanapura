# KalyanaPura

A single Next.js application for a shared Indian wedding workspace, with the public homepage, account authentication, wedding creation, private membership-scoped wedding details and events implemented. Further planning workflows remain deferred.

## Prerequisites and setup

- Node.js 24 LTS (the project targets the 24.x release line; `.nvmrc` records it).
- npm. Use npm and the included `package-lock.json` dependency manifest; do not introduce another lockfile.

```sh
npm ci
```

Optionally copy `.env.example` to `.env.local` and fill in the capabilities you intend to use. The placeholder pages and production build require no environment configuration or external services.

```sh
npm run dev
```

Open http://localhost:3000. Development reloads after edits.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint, with warnings treated as failures |
| `npm run typecheck` | Generate Next.js route types and run strict TypeScript without emitting files |
| `npm run build` | Production build |
| `npm start` | Serve the completed production build |
| `npm run check:contracts` | Repeatable HTTP/configuration/connection and TypeScript regression checks; no live services |
| `npm run check:accounts` | Isolated replica-set authentication/session/email integration checks; synthetic data only |
| `npm run check:weddings` | Isolated transactional creation, concurrency, isolation and configuration regressions |
| `npm run check:weddings:browser` | Isolated desktop/mobile login, creation, persistence and logout journey |
| `npm run check:events` | Isolated event validation, isolation, version, concurrency, capacity and rollback checks |
| `npm run check:events:browser` | Real desktop/mobile auth, wedding creation, event create/view/edit/conflict and dashboard journey |
| `npm run check:smoke` | Check an already running server (defaults to port 3100); optional browser checks |

If port 3000 is occupied, `npm run dev -- --port 3001` selects another port. Update `APP_ORIGIN` when later features generate links or check browser origins. For a local production smoke check, run `npm run build`, then `npm start`.

Development uses Webpack because the installed Next.js 16.4.0 Turbopack development server repeatedly triggered Fast Refresh in this Windows workspace while source files were unchanged. Switching to Webpack stopped the observed idle refresh loop; the underlying file-watcher trigger has not been isolated. Production builds retain the default bundler. To investigate Turbopack separately, run `npm exec -- next dev --turbopack` after stopping the existing server.

## Implemented scope

- `/`: responsive marketing homepage adapted from the approved Stitch design, with local fonts/images, labelled fictional product previews, mobile navigation, and expandable FAQs.
- `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`: real account forms backed by Better Auth; service configuration required.
- `/account`: server-validated, verified-account landing page and logout. No wedding access is granted.
- `/create-wedding`: verified-account creation form; saves the wedding and initial Admin membership atomically.
- `/dashboard`: live membership-scoped wedding identity and countdown, with clearly labelled fictional planning samples; anonymous visitors redirect to `/login`, and accounts without membership redirect to setup.
- `/preview/create-wedding`: public fictional UI preview without database writes.
- `/dashboard/events`: private ceremony itinerary, creation, detail view and version-protected editing; see [EVENTS.md](docs/EVENTS.md).
- Shared placeholder application shell, scoped homepage CSS Modules, a not-found page, and no-index metadata.
- Strict TypeScript, `@/*` imports, ESLint, and pinned npm dependencies.
- Browser-safe product API types and server-only JSON response/error helpers.
- Zod capability configuration and a lazy native MongoDB connection with a reused process-level pool.

Better Auth is mounted at `/api/auth/*`; only implemented account endpoints are exposed. `/api/inngest` serves the account-email functions, with signing required in production. `/api/v1/me`, POST `/api/v1/weddings` and GET `/api/v1/weddings/{weddingId}` are implemented; see [WEDDING_SETUP.md](docs/WEDDING_SETUP.md). Event list/create/detail/edit APIs are implemented too; other product workflows remain deferred. Account collections/indexes are initialized lazily when authentication is used; no provider accounts or live infrastructure are created by the application. A successful build does not establish Atlas connectivity or real email delivery.

### Homepage design

The public `/` page follows the owner's selected **KalyanaPura Marketing Homepage** screen in Stitch's **Duplicate of KalyanaPura Wedding Management Homepage** project (`9574853340286145696`, screen `58a899692ef9451b9fcd9180a6b815bf`). Its interactive wedding website section follows **KalyanaPura Marketing Homepage - With Website Theme Preview** (screen `f4d1070c386b473789033b5d98dfaba2`). Presentation lives in `src/modules/marketing/components`; the route supplies metadata and renders it. Mobile navigation and the theme selector are Client Components; native `details` elements provide accessible FAQ expansion. Classic Indian, Minimal Elegant (default), and Modern Celebration share fictional wedding details. Selection is local to the page, supports keyboard navigation, and does not create, save, or publish a website.

Stitch-exported imagery is stored in `public/images/homepage`. Cormorant Garamond and Plus Jakarta Sans are self-hosted with `next/font/local`; their OFL licenses are retained in `public/fonts`. The page does not load Tailwind/CDN scripts, remote images, or external font stylesheets. Fonts are scoped to the homepage so existing placeholder pages keep their styling.

Marketing wedding names, tasks, expenses, guest responses and photos are illustrative. Account and workspace actions lead to real account and wedding setup routes. Marketing previews do not submit RSVPs, upload media, take payments or publish websites. The design's unsupported unlimited-members promise and inactive legal links were omitted.

Homepage verification on 10 October 2026: lint, strict type checking, production build, contract checks, and production HTTP/desktop/mobile Edge smoke checks passed using Node 24.19.0. Smoke checks verify FAQ expansion, mobile menu selection, image loading, navigation, and horizontal overflow. Optional `SMOKE_SCREENSHOT_DIR` writes full-page and viewport screenshots. Production audit found zero issues; full audit retains the four high development findings documented below.

ESLint 10 uses compatible Next.js, TypeScript, and React Hooks plugins directly. The current `eslint-config-next` preset depends on React/import plugins whose peer ranges exclude ESLint 10, so that preset is not installed. TypeScript 5.9 is within the selected TypeScript ESLint plugin's supported range.

## Configuration

| Variable | Required when | Behavior |
| --- | --- | --- |
| `APP_ORIGIN` | Code generates canonical links or validates origins | Absolute HTTP/HTTPS origin, with no path/query/credentials. HTTPS required when the capability is used in production. `http://localhost:3000` is for local development. |
| `MONGODB_URI` | `getDatabase()` is called | MongoDB or MongoDB SRV connection URI; credentials remain server-only. |
| `MONGODB_DB_NAME` | `getDatabase()` is called | Explicit database name using letters, digits, underscores, or hyphens, at most 63 characters. |

Configuration is validated only when its capability is called. Empty database values do not prevent the basic shell from starting. There is no fake database, provider success, or unlimited quota fallback. Connection failures clear the cached attempt so a later call can retry. Configuration changes require a server restart.

The database helper does not run queries at import time. Use MongoDB Atlas with transaction support for later coordinated workflows; a standalone local MongoDB server is insufficient for those transaction requirements. Pool sizing and timeouts are initial bounded defaults, to be reviewed with the deployment host.

Never commit `.env.local` or real credentials. `.gitignore` ignores environment files except `.env.example`. Do not use `NEXT_PUBLIC_` for database, authentication, encryption, email, media, or job secrets.

## Architecture and boundaries

```text
src/app/          pages, layouts, future thin HTTP Route Handlers
src/components/layouts/  shared application presentation
src/components/ui/       reusable primitives when implemented
src/shared/http/         browser-safe HTTP contracts
src/server/       configuration, database connection, HTTP helpers
src/modules/marketing/   implemented public homepage presentation
src/modules/             business modules added with their workflows
scripts/          repeatable scaffold verification
```

Parenthesised App Router directories are route groups: `(marketing)/page.tsx` renders `/`, `(auth)/login/page.tsx` renders `/login`, and `(workspace)/dashboard/page.tsx` renders `/dashboard`. All share the existing root layout. Do not add a second page resolving to the same URL.

Server Components perform initial reads through services. Client interactions will use REST Route Handlers. Pages and UI must not query MongoDB directly. Services own business rules; repositories own wedding-scoped persistence; provider adapters own integration mechanics. Server infrastructure and module persistence import `server-only`. Client code may use public types and browser-safe validators, never server implementations.

When the events workflow is implemented, its module can be:

```text
src/modules/events/
  types.ts                 public input/response types
  schemas.ts               Zod input validation
  server/
    model.ts               native-driver stored document types
    repository.ts          wedding-scoped persistence
    service.ts             permissions, rules, workflow coordination
```

Native-driver models describe stored records; there is no Mongoose schema. MongoDB collection validators and indexes belong to later versioned migrations. Do not create every future module or introduce generic repository/workflow frameworks.

Feature-specific presentation belongs in its module's `components/` directory; genuinely shared presentation belongs in `src/components`. Modules may own `indexes.ts` definitions and meaningful server tests when implemented. Index application remains a controlled setup operation. No empty future directories are needed. Infrastructure imports `server-only`; browser-safe contracts never import server implementations.

## Product and HTTP contract

The approved baseline is KalyanaPura, one Next.js modular monolith, TypeScript, MongoDB Atlas with the official driver, Zod, and Better Auth for future member authentication. Cloudinary, Resend, and Inngest are approved deferred integrations. Vendor discovery opens Google Maps externally; it has no Places API or scraping integration.

Keep private API URLs from the API design, including `/api/v1/weddings/{weddingId}/...`. Resolve the authoritative wedding from current authenticated membership and check the URL ID against it. Guest links derive their wedding from validated token sources. Never trust a supplied ID as permission.

The HTTP helpers implement product success/list/accepted envelopes and safe error envelopes, request IDs, private/no-store headers, resource revision headers, Location, Retry-After, and empty 204 responses. Callers must supply safe response projections, accurate operation state, documented error codes, revisions, and pagination. Only generate `fields` entries from safe authored validation messages; do not copy raw provider errors or input values. The helpers do not enforce access, parse request bodies, implement transactions, or perform CSRF checks. Those accompany real endpoints. Auth, webhook, and image responses retain their own contracts.

## Design references and outstanding alignment

- [PRD](docs/PRD.md): product reference.
- [System design](docs/System_Design_Architecture_Doc.md): architecture and clarified permissions.
- [Database design](docs/Database_Design_Doc.md): persistence and concurrency reference.
- [API design](docs/API_Design_Doc.md): HTTP contract.

The actual filenames above differ from the original request's `SYSTEM_DESIGN.md`, `DATABASE_DESIGN.md`, and `API_DESIGN.md`. All original documents are preserved.

The owner approved KalyanaPura despite remaining Make My Marriage references in the PRD. The owner also approved the design's Admin-only photo deletion, Admin-only deletion of photo-containing events, private gallery separation from public websites, external Maps discovery, and event cascade deletion. Event deletion removes linked tasks/expenses/photos, retains guests/vendors, and detaches their associations. Vendor deletion retains expenses.

API section 24 requires upload reservation dedupe/signing/source-version fields and an index, plus wedding-lifetime retention of member-email command markers. Align the database specification and future migrations before coding those workflows; these are not implemented here. The API also selects guest token-to-cookie exchange from the database design's optional exchange approach. Guest cookies never replace current source/settings checks.

## Deferred implementation

Accounts are implemented with pinned Better Auth and its native MongoDB adapter: signup, verification/resend, login, password reset, logout, authoritative seven-day sessions, trusted callback checks, database rate limits, and protected `/account`. Auth email hooks persist encrypted jobs before dispatch through Inngest/Resend. Setup is required before real account use; follow [ACCOUNT_SETUP.md](docs/ACCOUNT_SETUP.md). Account integration checks use a disposable replica set with synthetic identities; real Atlas/provider delivery must be tested after configuration. The API owns auth response shapes; product envelopes remain separate. `/api/v1/me` now returns live membership and documented limits.

Wedding creation, initial Admin membership and private dashboard details are implemented; follow [WEDDING_SETUP.md](docs/WEDDING_SETUP.md). Invitations, member administration and last-Admin role/removal workflows remain deferred.

Then implement events/tasks; guests/import/invitations/RSVP/email; vendors/expenses; website/themes/livestream; and gallery/media/uploads/QR. Add security, meaningful tests, and failure handling alongside each workflow. Use Vitest for business rules, replica-set MongoDB integration tests for transactions/isolation, and Playwright for complete browser flows when needed; no test framework is installed for the placeholder shell.

Cloudinary, Resend, Inngest, CSV/QR/HEIC packages, provider webhook handlers, OpenAPI generation, analytics, deployment, backups, quotas, and retention operations are deferred. No live credentials are required for the current shell. R2, Google Places, microservices, Redis, BullMQ, GraphQL, realtime infrastructure, payments, budgets, guest accounts, and AI are outside this scaffold.

## Scaffold verification

Verified on 9 October 2026 using Node.js 24.19.0:

- `npm run lint`: passed, with zero warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed without database/provider configuration.
- 31 focused assertions for API envelopes/headers, error redaction, origin validation, and missing database configuration passed in the original temporary script. That build artifact is absent; repeatable contract and smoke checks now live under `scripts/` and include constructor-error, connection recovery/reuse, and TypeScript creation-response regressions.
- Production HTTP smoke checks: overview/login/dashboard returned 200; missing pages, deferred member/auth endpoints, and wedding creation returned 404.
- Headless browser checks at desktop (1280px) and mobile (390px): all three pages had no horizontal overflow; navigation and browser runtime checks passed. Preview screenshots are temporary ignored build artifacts.
- `npm audit --omit=dev`: zero findings.

The original and 10 October full audits report four high-severity development dependency findings from one chain. Installed versions are `@next/eslint-plugin-next@16.4.0` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects braces through 3.0.3 and still lists no patched version. Deeply nested brace patterns can exhaust the call stack.

The installed Next ESLint plugin's `get-root-dirs.js` passes `settings.next.rootDir` to `fast-glob.globSync`; this configuration supplies the fixed pattern `"."`. The inspected entry path consumes configuration rather than HTTP input. No application source imports this chain, and Next 16's production build does not invoke the separate ESLint script. This limits observed exposure to lint/tooling runs, including CI; development-only classification alone does not make the advisory harmless. Treat external lint patterns/configuration as untrusted code inputs. Registry metadata checked on 10 October reports latest versions 16.4.0 for the Next plugin and 3.0.3 for braces; no compatible patched release is available. The audit suggests plugin 14.2.35, a major downgrade that was not applied. Recheck the advisory and matching Next plugin releases before accepting a dependency remediation; no forced audit fix, major downgrade, or override is applied.

Repeatable checks use Node 24 and the repository's installed TypeScript/native driver. The contract script runs under Node's `react-server` condition to retain the real `server-only` boundary and compiles a virtual TypeScript fixture without writing source files. It uses only synthetic environment values and a simulated client for recovery checks; it does not verify live Atlas connectivity.

For smoke checks, start `npm start -- --port 3100`, then run `npm run check:smoke`. An alternate URL can be passed with `npm run check:smoke -- http://localhost:3000`. Browser checks use an already available `playwright` module, or an absolute module directory supplied through `PLAYWRIGHT_MODULE_PATH`; no package is installed by the script. `PLAYWRIGHT_CHANNEL=msedge` selects an already installed Edge browser. Missing browser tooling/executables are explicitly reported as not run. The scaffold has no favicon; only its automatic 404 console message is excluded. Stop the server after checking.

### Restructuring verification — 10 October 2026

Using Node 24.19.0, the final `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run check:contracts` passed. The first type-check attempt encountered stale `.next/dev/types` references to moved files; removing only those generated types and regenerating resolved it. Contract-script development failures were corrected before the final pass.

`npm start -- --port 3100` started successfully. `npm run check:smoke` passed HTTP routes, expected deferred endpoint 404s, and desktop/mobile (1280/390px) rendering/navigation/overflow checks using existing Playwright with installed Edge. The first browser attempt lacked downloaded Chromium; the subsequent Edge attempt identified the known missing favicon. No other console error is ignored. The smoke server was stopped after verification.

`npm audit --omit=dev --json` passed with zero findings. `npm audit --json` exited 1 with the four high findings documented above; this is separate from source/build failures. Stale source/import/documentation searches found no references to the moved paths. Dependencies and the lockfile were not changed.

Malformed application origins are rejected safely: the refinement guards URL parsing before accessing origin fields, so `getAppOrigin()` throws `CapabilityConfigurationError` and `errorResponse()` returns the sanitized 503 `TEMPORARILY_UNAVAILABLE` response. The contract script checks malformed, empty, and missing origins alongside valid-origin and origin-policy cases.

## Account feature verification — 10 October 2026

| Command/check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed without service credentials |
| `npm run check:contracts` | Passed, including malformed origin and connection reuse/recovery |
| `npm run check:accounts` | Passed against disposable MongoDB 8.2.6 replica set: signup/duplicate handling, verification, unverified rejection, login, reset/replay rejection, logout, session expiry/revocation, HTTPS cookies, ID mapping, database rate limits, callback/origin/body bounds, encrypted email retry/claims/deadlines |
| `npm run check:weddings` | Isolated transactional creation, concurrency, isolation and configuration regressions |
| `npm run check:weddings:browser` | Isolated desktop/mobile login, creation, persistence and logout journey |
| `npm run check:smoke` | Passed HTTP and Edge/Playwright checks at 1280/390px: all account forms render, anonymous `/account` redirects, unconfigured signup fails clearly and can retry, homepage/navigation/theme checks remain passing |
| `npm audit --omit=dev` | Passed: zero production vulnerabilities |
| `npm audit` | Failed: the four previously documented development findings in the braces chain remain |
| `npm ls --depth=0` | Exit 0, pinned direct dependencies match; optional `@emnapi/runtime` and `@img/sharp-wasm32` entries are reported extraneous in the existing installation |
| Atlas connectivity, real Resend delivery, local/cloud Inngest execution, complete browser journey with configured services | Not run: service credentials and sender setup are absent. Follow `docs/ACCOUNT_SETUP.md`, then verify real inbox delivery and the full browser journey |

The browser smoke check initially used an overly strict password-label locator; the label includes its password-length hint. The corrected locator passed. Expected favicon 404 and deliberately unconfigured signup 503 console messages are excluded; other browser errors fail the check. Unit/integration email sends use a controlled synthetic provider callback, never a runtime fake-success adapter. No services were purchased, infrastructure changed, or code committed/pushed/deployed.

The machine's default Node.js remains 20.19.0; the bundled Node 24 runtime was invoked explicitly for verification. Initial installation used the system npm launcher and emitted the project engine warning; the final dependency update and checks used Node 24. Use Node 24 for normal local work.

Live Atlas connectivity, auth sessions, email, media, jobs, isolation transactions, and domain workflows were not tested because they are deferred. No commit, push, or deployment was performed.

### Wedding workspace and UI previews

`/create-wedding` is now a real verified-account form. `/dashboard` resolves live membership and shows saved couple names, wedding date/location/title, actual Admin/Manager role and an Asia/Kolkata countdown. Events and their count now use saved data; tasks, RSVPs and expenses remain explicitly labelled samples; coming-soon dialogs perform no product writes. The desktop sidebar is sticky, and mobile navigation uses a native dialog.

The original fictional onboarding design remains at `/preview/create-wedding`, with in-memory form-to-dashboard preview and no wedding API requests. Stitch references: **KalyanaPura - Wedding Creation Onboarding** (`e68eb3544c18403699e6598e61286395`) and **KalyanaPura - Wedding Dashboard** (`466eaf0bf6254d828b281eaee485590e`) in project `9574853340286145696`. The dashboard layout also draws from the [Make My Marriage reference](https://github.com/akshaymarch7/make-my-marriage/tree/dev/src/components), using local CSS Modules.

Creation/configuration, private HTTP contracts, zero media quota, key recovery and production backup prerequisites are documented in [WEDDING_SETUP.md](docs/WEDDING_SETUP.md). Earlier verification sections above record historical milestones, not the current feature's operational readiness.

### Wedding increment verification — 10 October 2026

| Command/check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; real private routes are dynamic, pure UI preview is static |
| `npm run check:contracts` | Passed |
| `npm run check:accounts` | Passed against isolated local replica set |
| `npm run check:weddings` | Passed: real auth, strict validation, CSRF/body limits, safe projections, encrypted defaults, unique membership under concurrent creation, transaction rollback, foreign-wedding denial, removing/forged/expired sessions and Kolkata calendar boundaries |
| `npm run check:weddings:browser` | Passed in installed Edge at 1280/390px: login → create wedding → persisted dashboard → reload → existing-member redirect → logout → private-route denial |
| `npm run check:smoke -- http://localhost:3101` | Passed production HTTP and desktop/mobile browser checks, including the retained fictional preview; live database access was disabled |
| `npm audit --omit=dev` | Passed: zero production vulnerabilities |
| `npm audit` | Failed: four previously documented high findings in the development braces dependency chain; dependencies unchanged |
| Live Atlas wedding writes, real provider delivery, backup restore and future workflows | Not run; automated tests use isolated synthetic accounts and no provider sends |

Initial verification exposed lint issues and a mobile rule hiding the real role badge; these were corrected before final passes. The temporary production smoke server and isolated test servers/databases were stopped. No commit, push, deployment or live infrastructure change was performed.

### Events increment — 10 October 2026

Events use real wedding-scoped persistence: creation, detail view, chronological lists, version-protected editing, and saved dashboard count/upcoming itinerary. The owner-approved capacity is 25 per wedding. Cover uploads, event deletion, exports/calendar sync and linked product workflows remain deferred. See [EVENTS.md](docs/EVENTS.md) for contracts and verification details.

Final lint, typecheck, build, contract/account/wedding regressions, event integration checks and the real desktop/mobile event browser journey passed. Production HTTP/browser smoke checks passed with live database access disabled. Production audit passed; the full audit retains the four known development findings. Live Atlas event writes, providers and backup restoration were not run. No commit, push or deployment was performed.

### Guest list design preview

The existing Stitch “KalyanaPura - Guest List” screen informs the guest directory design. `/preview/guests` retains entirely fictional data for review without signing in. Its search, RSVP/event filters, guest details and add/edit drawers operate only on in-memory sample state; refreshing restores the samples. This separate prototype performs no persistence or invitation delivery. `/dashboard/guests` now uses saved data as described below.

Desktop/mobile presentation checks use existing Playwright tooling: `node scripts/guest-preview-check.cjs http://localhost:3100` (set `PLAYWRIGHT_MODULE_PATH` if needed, and optionally `PLAYWRIGHT_CHANNEL`). They make no product writes or provider requests.

### Saved guest management

`/dashboard/guests` now uses saved wedding-scoped guests, with contact details, party limits, notes, active event assignments, details, version-protected edits, name-prefix search, RSVP/event filters and pagination. The dashboard guest-group count is real. `/preview/guests` retains fictional sample data. Guest RSVP collection is implemented. CSV guest import is implemented; see docs/GUEST_IMPORT.md. Deletion and automated messaging are deferred. See [GUESTS.md](docs/GUESTS.md); run `check:guests` and `check:guests:browser` for isolated regressions.

### Personal invitation links

Open a saved guest's details and load the invitation controls to copy, disable/enable or replace their link. `/invite/{token}` opens real scoped wedding/event details at the clean `/invitation` URL using a separate encrypted guest cookie, without an account. Replaced/disabled links and their derived access are rechecked on every request. `/preview/invitation` remains a fictional design preview. Guests can save and change their overall RSVP through the invitation; dashboard totals derive from saved responses. See [RSVP.md](docs/RSVP.md) and run `check:rsvp` plus `check:rsvp:browser`. Galleries/media and delivery remain deferred. See [INVITATIONS.md](docs/INVITATIONS.md); run `check:invitations` and `check:invitations:browser` with existing local tooling. No new dependency or credential is required.
