import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "@/server/db/connection";
import { getAuthConfig, getMailConfig } from "./config";
import { queueAccountEmail } from "@/server/jobs/account-email";

export async function prepareAccountIndexes(db: Db) {
  await Promise.all([
    db.collection("user").createIndex({ email: 1 }, { unique: true, name: "user_email_uidx" }),
    db.collection("session").createIndex({ token: 1 }, { unique: true, name: "session_token_uidx" }),
    db.collection("session").createIndex({ userId: 1 }, { name: "session_userId_idx" }),
    db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
    db.collection("verification").createIndex({ identifier: 1 }, { name: "verification_identifier_idx" }),
    db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("rate_limits").createIndex({ key: 1 }, { unique: true, name: "rate_limits_key_uidx" }),
    db.collection("background_jobs").createIndex({ dedupeKey: 1 }, { unique: true }),
    db.collection("background_jobs").createIndex({ kind: 1, weddingId: 1, state: 1, availableAt: 1 }),
    db.collection("background_jobs").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export function createAccountAuth(db: Db, client: MongoClient, config: { origin: string; secret: string }, queue: (input: { userId: string; email: string; url: string; type: "auth_verification" | "auth_reset" }) => Promise<void>) {
  return betterAuth({
    appName: "KalyanaPura", baseURL: config.origin, secret: config.secret,
    trustedOrigins: [config.origin], database: mongodbAdapter(db, { client }),
    logger: { disabled: true },
    emailAndPassword: { enabled: true, requireEmailVerification: true, autoSignIn: false,
      minPasswordLength: 8, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      // Match real MongoDB IDs without exposing the existing account identity.
      customSyntheticUser: ({ coreFields, additionalFields }) => ({
        ...coreFields, ...additionalFields, id: new ObjectId().toHexString(),
      }),
      sendResetPassword: async ({ user, url }) => queue({ userId: user.id, email: user.email, url, type: "auth_reset" }),
    },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => queue({ userId: user.id, email: user.email, url, type: "auth_verification" }),
    },
    session: { expiresIn: 7 * 86400, disableSessionRefresh: true, cookieCache: { enabled: false } },
    user: { deleteUser: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", modelName: "rate_limits", window: 60, max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 10 }, "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 }, "/send-verification-email": { window: 60, max: 3 } },
    },
    advanced: { cookiePrefix: "kalyanapura", useSecureCookies: config.origin.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-kalyanapura-client-ip"] },
    },
  });
}

let instance: Promise<ReturnType<typeof createAccountAuth>> | undefined;
export function getAuth() {
  if (!instance) {
    instance = (async () => {
      const config = getAuthConfig();
      const db = await getDatabase();
      const client = await getMongoClient();
      await prepareAccountIndexes(db);
      return createAccountAuth(db, client, config, async (input) => {
        const mail = getMailConfig();
        await queueAccountEmail(db, input, mail.encryptionKey, mail.from);
      });
    })().catch((error) => { instance = undefined; throw error; });
  }
  return instance;
}
