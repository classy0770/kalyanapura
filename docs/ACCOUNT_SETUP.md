# Account setup for local development

Accounts use Better Auth 1.7.7, its MongoDB adapter, Resend, and Inngest. The homepage and forms render without configuration; account capabilities fail closed when their required configuration is missing. `/dashboard` is still a public fictional preview. `/account` is protected; wedding creation and membership are deferred. Do not use the preview dashboard for private data.

## 1. Create the database

1. Register at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Create a project and a **Free** cluster. Use a nearby available region; sample datasets are unnecessary.
3. Under Database Access, create a database user with a strong generated password and read/write access limited to the `kalyanapura` database. This is a database credential, separate from your Atlas login.
4. Under Network Access, add your current IP address. Update it if your connection changes; do not open access to every IP for convenience.
5. Choose **Connect → Drivers → Node.js** and copy the `mongodb+srv://...` connection string. Substitute the database username/password and percent-encode special characters in credentials.
6. Store it in `.env.local` as `MONGODB_URI`; set `MONGODB_DB_NAME=kalyanapura`. Atlas supplies the replica set needed for adapter transactions. The application lazily creates its auth/job indexes on first account use.

Official instructions: [Atlas UI getting started](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

## 2. Configure email

1. Create a [Resend account](https://resend.com/signup) and create an API key for sending email.
2. For your first local test, set `AUTH_EMAIL_FROM=onboarding@resend.dev` and sign up using the email address associated with your Resend account. This test sender cannot send verification emails to arbitrary recipients.
3. For other recipients, add a domain you already own in Resend, add its DNS records at your DNS provider, and wait for verification. Then set `AUTH_EMAIL_FROM` to an address on that domain. Keep click/open tracking disabled for account emails.
4. Save the API key as `RESEND_API_KEY` in `.env.local`. Do not paste it into chat, commit it, or put it in a `NEXT_PUBLIC_` variable.

Official instructions: [Resend test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [verified domains](https://resend.com/docs/dashboard/domains/introduction).

## 3. Create local configuration

Copy `.env.example` to `.env.local` if the latter does not exist. Preserve any existing local settings. The example contains placeholders; do not use placeholders as secrets.

Generate two independent keys in your terminal by running this command **twice**:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use one result for `BETTER_AUTH_SECRET`, the other for `AUTH_EMAIL_ENCRYPTION_KEY`. Keep these keys stable; changing the encryption key makes pending encrypted emails unreadable.

```dotenv
APP_ORIGIN=http://localhost:3000
MONGODB_URI=<your Atlas connection string>
MONGODB_DB_NAME=kalyanapura
BETTER_AUTH_SECRET=<first generated key>
AUTH_EMAIL_ENCRYPTION_KEY=<second generated key>
RESEND_API_KEY=<your Resend key>
AUTH_EMAIL_FROM=onboarding@resend.dev
INNGEST_DEV=1
```

If using port 3100 instead, set `APP_ORIGIN=http://localhost:3100`. Browse exactly that origin, including the hostname and port. Production origin validation requires HTTPS; local HTTP testing should use `npm run dev`, not production-mode account actions.

## 4. Run email delivery and the application

In a separate terminal, start the [Inngest local dev server](https://www.inngest.com/docs/getting-started/nextjs-quick-start):

```powershell
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

This command downloads/runs the local development CLI; it does not deploy the app. The application SDK itself is pinned in `package-lock.json`. Leave the local server running while testing email delivery.

In the project terminal:

```powershell
npm run dev
```

Visit `/signup`, create an account with your allowed recipient email, open the verification email, log in, and check `/account`. Then log out. Test **Forgot password** and confirm older sessions are denied after reset.

If mail does not arrive, check spam, your Resend sender/recipient restrictions, and Inngest execution status. A queued email is durable but is not a delivery guarantee. Do not copy bearer links, job ciphertext, or provider errors into public logs. Explicitly requesting another verification/reset email generates a fresh library-controlled link.

## 5. Verification and deployment limits

```powershell
npm run lint
npm run typecheck
npm run build
npm run check:contracts
npm run check:accounts
```

`check:accounts` uses an ephemeral local MongoDB replica set and synthetic identities only. Its first run can download a MongoDB binary. It never loads `.env.local`, contacts Atlas, sends real emails, or tests cloud dispatch. Browser smoke checks use the existing Playwright tooling documented in README.

Before any deployment, configure an HTTPS origin, verified sending domain, Inngest event/signing keys, a registered signed `/api/inngest` endpoint, and unset `INNGEST_DEV`. Only configure `AUTH_TRUSTED_IP_HEADER` when the deployment proxy overwrites that header and cannot be bypassed. Otherwise the implementation deliberately uses one conservative shared database rate-limit bucket instead of trusting client-supplied IP headers. A real multi-user deployment needs that trusted-proxy configuration. No deployment or live infrastructure setup is included here.

Email jobs retain only encrypted payloads until acceptance or terminal failure. A minute-based Inngest reconciliation function recovers pending publication and expired leases, with bounded attempts and a one-hour token deadline. Provider idempotency keys remain stable across retries. Delivery evidence records acceptance separately from inbox delivery; webhook delivery tracking is deferred.
