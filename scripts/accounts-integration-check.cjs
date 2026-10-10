// Isolated replica set only. Never loads .env.local or connects to Atlas.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { sourceLoader } = require("./scaffold-contract-check.cjs");

async function main() {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "8.2.6" } });
  const client = new MongoClient(replica.getUri());
  try {
    await client.connect();
    const db = client.db("accounts_isolated_test");
    const load = sourceLoader();
    const { createAccountAuth, prepareAccountIndexes } = load("src/modules/accounts/server/auth.ts");
    const mail = load("src/server/jobs/account-email.ts");
    await prepareAccountIndexes(db);
    const origin = "http://localhost:3100";
    const key = randomBytes(32).toString("hex");
    const queued = [];
    const auth = createAccountAuth(db, client, { origin, secret: randomBytes(32).toString("hex") }, async (input) => {
      queued.push(input);
      await mail.queueAccountEmail(db, input, key, "onboarding@resend.dev");
    });
    const headers = { origin, "content-type": "application/json", "x-kalyanapura-client-ip": "127.0.0.1" };
    const request = (path, body, cookie) => auth.handler(new Request(`${origin}/api/auth/${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...headers, ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    const credentials = { name: "Sample Member", email: "member@example.com", password: "Synthetic-password-123" };
    const signup = await request("sign-up/email", { ...credentials, callbackURL: "/login?verified=1" });
    assert.equal(signup.status, 200);
    const signupBody = await signup.json();
    assert.equal(queued.length, 1);
    const stored = await db.collection("background_jobs").findOne({});
    assert.ok(!stored.email.payloadCiphertext.includes(credentials.email));
    assert.equal(mail.decryptMail(stored.email.payloadCiphertext, key).to, credentials.email);
    assert.throws(() => mail.decryptMail(stored.email.payloadCiphertext, randomBytes(32).toString("hex")));
    assert.equal((await request("sign-in/email", credentials)).status, 403, "Unverified accounts cannot sign in");
    const duplicate = await request("sign-up/email", { ...credentials, callbackURL: "/login?verified=1" });
    assert.equal(duplicate.status, 200, "Duplicate signup preserves enumeration protection");
    const duplicateBody = await duplicate.json();
    assert.deepEqual(Object.keys(duplicateBody).sort(), Object.keys(signupBody).sort());
    for (const body of [signupBody, duplicateBody]) {
      assert.match(body.user.id, /^[0-9a-f]{24}$/, "Both signup paths return MongoDB ObjectId-shaped IDs");
      assert.equal(body.token, null, "Neither signup path grants a session");
    }
    assert.notEqual(duplicateBody.user.id, signupBody.user.id, "Duplicate signup must never disclose the existing account ID");
    assert.equal(await db.collection("user").countDocuments({ email: credentials.email }), 1);
    assert.ok(new ObjectId((await db.collection("user").findOne({ email: credentials.email }))._id));
    const verification = await auth.handler(new Request(queued[0].url));
    assert.equal(verification.status, 302);
    assert.equal((await request("sign-in/email", { email: credentials.email, password: "incorrect" })).status, 401);
    let login = await request("sign-in/email", credentials);
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(login.headers.get("set-cookie"), /SameSite=Lax/i);
    const cookie = login.headers.getSetCookie().find((value) => value.includes("session_token=")).split(";")[0];
    const session = await (await request("get-session", undefined, cookie)).json();
    assert.equal(session.user.emailVerified, true);
    assert.match(session.user.id, /^[0-9a-f]{24}$/);
    assert.equal(session.user.password, undefined);
    const navigation = { redirect: (location) => { throw Object.assign(new Error("Redirect"), { location }); } };
    const { requireVerifiedAccount } = sourceLoader({ "./auth": { getAuth: async () => auth }, "next/navigation": navigation })("src/modules/accounts/server/session.ts");
    const dashboardHeaders = (cookie) => new globalThis.Headers(cookie ? { cookie } : {});
    const deniedDashboard = (cookie) => assert.rejects(() => requireVerifiedAccount(dashboardHeaders(cookie)), { location: "/login" });
    assert.equal((await requireVerifiedAccount(dashboardHeaders(cookie))).id, session.user.id, "Verified live session permits dashboard access");
    await deniedDashboard();
    await deniedDashboard("kalyanapura.session_token=forged");
    const unverifiedGuard = sourceLoader({ "./auth": { getAuth: async () => ({ api: { getSession: async () => ({ user: { ...session.user, emailVerified: false } }) } }) }, "next/navigation": navigation })("src/modules/accounts/server/session.ts").requireVerifiedAccount;
    await assert.rejects(() => unverifiedGuard(dashboardHeaders(cookie)), { location: "/verify-email" });
    const persisted = await db.collection("session").findOne({ userId: new ObjectId(session.user.id) });
    assert.ok(persisted);
    assert.ok(Math.abs(persisted.expiresAt - persisted.createdAt - 7 * 86400000) < 2000);
    await request("get-session", undefined, cookie);
    assert.equal((await db.collection("session").findOne({ _id: persisted._id })).expiresAt.getTime(), persisted.expiresAt.getTime(), "Session lifetime never slides");
    assert.equal(await (await request("get-session", undefined, "kalyanapura.session_token=forged")).json(), null);
    assert.equal((await request("request-password-reset", { email: credentials.email, redirectTo: "/reset-password" })).status, 200);
    const reset = queued.find((input) => input.type === "auth_reset");
    assert.ok(reset);
    const callback = await auth.handler(new Request(reset.url));
    assert.equal(callback.status, 302);
    const token = new URL(callback.headers.get("location"), origin).searchParams.get("token");
    assert.equal((await request("reset-password", { token, newPassword: "New-synthetic-password-123" })).status, 200);
    assert.equal(await (await request("get-session", undefined, cookie)).json(), null, "Password reset revokes existing sessions");
    assert.equal((await request("reset-password", { token, newPassword: "Replayed-password-123" })).status, 400, "Reset token is single use");
    login = await request("sign-in/email", { email: credentials.email, password: "New-synthetic-password-123" });
    assert.equal(login.status, 200);
    const newCookie = login.headers.getSetCookie().find((value) => value.includes("session_token=")).split(";")[0];
    assert.equal((await request("sign-out", {}, newCookie)).status, 200);
    assert.equal(await (await request("get-session", undefined, newCookie)).json(), null);
    await deniedDashboard(newCookie);
    login = await request("sign-in/email", { email: credentials.email, password: "New-synthetic-password-123" });
    const expiringCookie = login.headers.getSetCookie().find((value) => value.includes("session_token=")).split(";")[0];
    await db.collection("session").updateMany({ userId: new ObjectId(session.user.id) }, { $set: { expiresAt: new Date(0) } });
    assert.equal(await (await request("get-session", undefined, expiringCookie)).json(), null, "Expired sessions are denied before TTL cleanup");
    await deniedDashboard(expiringCookie);
    const unknownReset = await request("request-password-reset", { email: "unknown@example.com", redirectTo: "/reset-password" });
    assert.equal(unknownReset.status, 200);
    assert.equal(queued.filter((input) => input.email === "unknown@example.com").length, 0);
    const secureAuth = createAccountAuth(db, client, { origin: "https://accounts.example.com", secret: key }, async () => {});
    const secureLogin = await secureAuth.handler(new Request("https://accounts.example.com/api/auth/sign-in/email", { method: "POST", headers: { ...headers, origin: "https://accounts.example.com", "x-kalyanapura-client-ip": "10.0.0.2" }, body: JSON.stringify({ email: credentials.email, password: "New-synthetic-password-123" }) }));
    assert.equal(secureLogin.status, 200);
    assert.match(secureLogin.headers.get("set-cookie"), /; Secure/i);

    let sends = 0;
    const providerKeys = [];
    const deliver = async (_payload, idempotencyKey) => { sends++; providerKeys.push(idempotencyKey); if (sends === 1) throw new Error("Synthetic provider outage"); return "synthetic_provider_id"; };
    await Promise.all([mail.deliverAccountEmail(db, stored._id.toHexString(), key, deliver), mail.deliverAccountEmail(db, stored._id.toHexString(), key, deliver)]);
    assert.equal(sends, 1, "Concurrent workers claim only once");
    await db.collection("background_jobs").updateOne({ _id: stored._id }, { $set: { availableAt: new Date(0) } });
    await mail.deliverAccountEmail(db, stored._id.toHexString(), key, deliver);
    assert.equal(sends, 2);
    assert.equal(providerKeys[0], providerKeys[1]);
    assert.equal((await db.collection("background_jobs").findOne({ _id: stored._id })).state, "succeeded");
    assert.equal((await db.collection("background_jobs").findOne({ _id: stored._id })).email.payloadCiphertext, null);
    const resetJob = await db.collection("background_jobs").findOne({ "email.type": "auth_reset" });
    await db.collection("background_jobs").updateOne({ _id: resetJob._id }, { $set: { "email.retryDeadlineAt": new Date(0) } });
    await mail.deliverAccountEmail(db, resetJob._id.toHexString(), key, deliver);
    assert.equal((await db.collection("background_jobs").findOne({ _id: resetJob._id })).state, "cancelled");
    assert.equal(sends, 2, "Expired bearer links are never sent");
    await db.collection("background_jobs").updateOne({ _id: resetJob._id }, { $set: { state: "running", attempts: 5, leaseUntil: new Date(0) } });
    await mail.deliverAccountEmail(db, resetJob._id.toHexString(), key, deliver);
    assert.equal((await db.collection("background_jobs").findOne({ _id: resetJob._id })).state, "failed", "A crash on the last attempt does not strand work");

    const saved = new Map(["BETTER_AUTH_SECRET", "APP_ORIGIN", "NODE_ENV", "RESEND_API_KEY", "AUTH_EMAIL_FROM", "AUTH_EMAIL_ENCRYPTION_KEY", "INNGEST_DEV"].map((name) => [name, process.env[name]]));
    try {
      process.env.BETTER_AUTH_SECRET = key; process.env.APP_ORIGIN = origin; process.env.NODE_ENV = "development";
      process.env.RESEND_API_KEY = "re_synthetic_test_only"; process.env.AUTH_EMAIL_FROM = "onboarding@resend.dev";
      process.env.AUTH_EMAIL_ENCRYPTION_KEY = key; process.env.INNGEST_DEV = "1";
      const handle = sourceLoader({ "./auth": { getAuth: async () => auth }, "next/server": { after: () => {} } })("src/modules/accounts/server/handler.ts").handleAuth;
      const publicSignup = async () => handle(new Request(`${origin}/api/auth/sign-up/email`, { method: "POST", headers, body: JSON.stringify({ ...credentials, email: "public-signup@example.com" }) }));
      const freshResponse = await publicSignup();
      const existingResponse = await publicSignup();
      assert.equal(freshResponse.status, 200);
      assert.equal(existingResponse.status, freshResponse.status);
      const freshBody = await freshResponse.json();
      const existingBody = await existingResponse.json();
      assert.deepEqual(Object.keys(existingBody).sort(), Object.keys(freshBody).sort());
      assert.deepEqual(Object.keys(existingBody.user).sort(), Object.keys(freshBody.user).sort());
      for (const body of [freshBody, existingBody]) {
        assert.match(body.user.id, /^[0-9a-f]{24}$/);
        assert.equal(body.user.image, null);
        assert.equal(body.token, null);
      }
      assert.notEqual(existingBody.user.id, freshBody.user.id);
      assert.equal((await handle(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { ...headers, origin: "https://untrusted.example" }, body: JSON.stringify(credentials) }))).status, 403);
      assert.equal((await handle(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ ...credentials, callbackURL: "https://untrusted.example" }) }))).status, 400);
      for (const callbackURL of ["/dashboard", `${origin}/dashboard`]) {
        const dashboardLogin = await handle(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ email: credentials.email, password: "New-synthetic-password-123", callbackURL }) }));
        assert.equal(dashboardLogin.status, 200, "Approved dashboard callback accepts verified login");
        assert.equal((await dashboardLogin.json()).url, callbackURL);
        assert.match(dashboardLogin.headers.get("set-cookie"), /HttpOnly/i);
      }
      assert.equal((await handle(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ ...credentials, callbackURL: "/account" }) }))).status, 400, "Login callback allowlist remains narrow");
      assert.equal((await handle(new Request(`${origin}/api/auth/reset-password/not-a-real-token?callbackURL=/reset-password`))).status, 302);
      assert.equal((await handle(new Request(`${origin}/api/auth/delete-user`, { method: "POST", headers, body: "{}" }))).status, 404);
      assert.equal((await handle(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ password: "x".repeat(20000) }) }))).status, 413);
      for (let attempt = 0; attempt < 10; attempt++) await request("sign-in/email", { email: credentials.email, password: "wrong" });
      assert.equal((await request("sign-in/email", credentials)).status, 429);
    } finally { for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
    console.log("PASS: isolated MongoDB signup/verification/login/reset/logout, ID mapping, session cookies/lifetime/revocation, encrypted mail claims/retries, origins and callbacks.");
    console.log("NOT RUN: Atlas connectivity and real Resend/Inngest delivery; credentials and sender setup are required.");
  } finally { await client.close(); await replica.stop(); }
}
main().catch((error) => { console.error("FAIL: isolated account integration checks:", error.message.replace(/https?:\/\/\S+/g, "[redacted URL]")); process.exitCode = 1; });
