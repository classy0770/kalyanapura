# KalyanaPura engineering instructions

## Approved architecture

One Next.js App Router modular monolith on Node.js 24, strict TypeScript, npm with one `package-lock.json`, native MongoDB driver against Atlas, Zod validation, and Better Auth for member authentication. Styling starts with plain CSS/CSS Modules. No Mongoose, custom auth system, separate Express/Nest backend, monorepo, Redis, BullMQ, GraphQL, or realtime infrastructure.

References: `docs/PRD.md` (product), `docs/System_Design_Architecture_Doc.md` (architecture), `docs/Database_Design_Doc.md` (persistence), `docs/API_Design_Doc.md` (HTTP). Preserve documents and surface material conflicts. Owner-approved name: KalyanaPura. Clarifications include Admin-only photo deletion, external Maps discovery, private galleries separate from public websites, and event cascade deletion. API section 24's persistence refinements need alignment before related workflows are coded.

## Code boundaries

- `src/app`: pages/layouts and thin Route Handlers; no direct database queries. Initial server reads call services; browser mutations use REST.
- `src/components/layouts`: shared application presentation. Add `src/components/ui` only for implemented shared primitives. Feature-specific UI belongs in its module.
- `src/shared/http`: browser-safe HTTP contracts (`api-contract.ts`); no server imports.
- Route groups `(marketing)`, `(auth)`, and `(workspace)` preserve `/`, `/login`, and `/dashboard`; retain one root layout and avoid duplicate resolved URLs.
- `scripts`: repeatable scaffold checks; do not store useful verification scripts in disposable `.next` output.
- Future `src/modules/<domain>`: public types/Zod schemas; `server/` services, stored document types and repositories.
- `src/server`: capability configuration, database, HTTP, and future provider adapters. Mark server implementations `server-only`; never put secrets or persistence in client bundles.
- Keep Node.js runtime for auth/database/provider handlers. Connect lazily, reuse a bounded pool, and validate configuration when used. Never fake provider success.

## Wedding isolation and consistency

One current wedding membership per account. Resolve private wedding context from the authenticated account's live membership; validate URL wedding IDs against it. Every resource and relationship must belong to that wedding. Guests derive scope from validated invitation/gallery capabilities; they never gain member permissions.

Enforce permissions on every entry path. Only Admins administer members or delete photos/photo-containing events. Protect the final Admin under concurrent actions. All wedding product mutations follow the documented coordination write and short transaction; provider calls stay outside transactions. Preserve documented API paths, projections, headers, exact paise strings, date semantics, version checks, and idempotency rules. Do not serialize stored documents wholesale or expose bearer tokens/provider secrets in logs.

## Current scope and verification

The public homepage is implemented in `src/modules/marketing` with CSS Modules, local assets, clearly labelled fictional previews, mobile navigation, and FAQs. Accounts are implemented in `src/modules/accounts` with Better Auth, protected `/account`, and durable encrypted verification/reset emails through Inngest/Resend. Setup is documented in `docs/ACCOUNT_SETUP.md`; run `npm run check:accounts` against its isolated replica set for account integration regressions. Dashboard preview requires a verified account session and holds no private wedding data; wedding membership and domain APIs are deferred. Do not add fake auth guards, successful stub endpoints, or future modules without authorisation.

Run `npm run lint`, `npm run typecheck`, and `npm run build` after relevant changes. Smoke-check affected pages; add meaningful workflow/integration tests when implementing real business logic. Report exact pass/fail/unrun results. Do not commit, push, deploy, purchase services, or change live infrastructure without explicit authorisation.

Run `npm run check:contracts` for HTTP/configuration/connection and creation-response type regressions. For an already running production server on port 3100, run `npm run check:smoke`; an alternate base URL may be passed after `--`. Browser checks require existing Playwright tooling (optionally via `PLAYWRIGHT_MODULE_PATH`) and report unavailable tooling explicitly. Run production and full dependency audits separately; the unresolved braces advisory and inspected tooling exposure are documented in README. Do not change dependencies to resolve it without separate approval.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
