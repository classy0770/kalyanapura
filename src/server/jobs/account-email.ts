import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { Long, ObjectId, type Db } from "mongodb";
import { Resend } from "resend";
import { getDatabase } from "@/server/db/connection";
import { getMailConfig } from "@/modules/accounts/server/config";

type MailPayload = { from: string; to: string; subject: string; text: string };
type EmailJob = {
  _id: ObjectId; kind: "email"; schemaVersion: number; weddingId: null;
  dedupeKey: string; requestFingerprint: string; requestedByUserId: string;
  target: { userId: string }; state: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  dispatchState: "pending" | "published"; dispatchAttempts: number; attempts: number;
  nextDispatchAt: Date; availableAt: Date; leaseToken: string | null; leaseUntil: Date | null;
  leaseRevision: Long; phase: null; cursor: null; lastErrorCode: string | null;
  createdAt: Date; updatedAt: Date; finishedAt: Date | null; purgeAt?: Date;
  email: { type: "auth_verification" | "auth_reset"; payloadCiphertext: string | null;
    providerMessageId: string | null; idempotencyKey: string; firstAttemptAt: Date | null;
    retryDeadlineAt: Date; evidence: { acceptedAt: Date | null; deliveredAt: null; bouncedAt: null; complainedAt: null; failedAt: Date | null } };
};

export function encryptMail(payload: MailPayload, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const content = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString("base64");
}

export function decryptMail(ciphertext: string, key: string): MailPayload {
  const data = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}

export async function queueAccountEmail(db: Db, input: { userId: string; email: string; url: string; type: EmailJob["email"]["type"] }, key: string, from: string) {
  const fingerprint = createHash("sha256").update(`${input.type}:${input.url}`).digest("hex");
  const now = new Date();
  const id = new ObjectId();
  const verification = input.type === "auth_verification";
  const payload = { from, to: input.email, subject: verification ? "Verify your KalyanaPura email" : "Reset your KalyanaPura password", text: `${verification ? "Verify your email" : "Reset your password"} using this link (valid for one hour):\n\n${input.url}\n\nIf you did not request this, ignore this email.` };
  const job: EmailJob = { _id: id, kind: "email", schemaVersion: 1, weddingId: null,
    dedupeKey: `auth-email:${fingerprint}`, requestFingerprint: fingerprint, requestedByUserId: input.userId,
    target: { userId: input.userId }, state: "queued", dispatchState: "pending", dispatchAttempts: 0, attempts: 0,
    nextDispatchAt: now, availableAt: now, leaseToken: null, leaseUntil: null, leaseRevision: Long.ZERO,
    phase: null, cursor: null, lastErrorCode: null, createdAt: now, updatedAt: now, finishedAt: null,
    email: { type: input.type, payloadCiphertext: encryptMail(payload, key), providerMessageId: null,
      idempotencyKey: `auth-email-${id.toHexString()}`, firstAttemptAt: null,
      retryDeadlineAt: new Date(now.getTime() + 60 * 60 * 1000),
      evidence: { acceptedAt: null, deliveredAt: null, bouncedAt: null, complainedAt: null, failedAt: null } } };
  const jobs = db.collection<EmailJob>("background_jobs");
  await jobs.updateOne({ dedupeKey: job.dedupeKey }, { $setOnInsert: job }, { upsert: true });
  const saved = await jobs.findOne({ dedupeKey: job.dedupeKey }, { projection: { _id: 1 } });
  if (!saved) throw new Error("Email queue unavailable");
  return saved._id.toHexString();
}

// The provider call stays outside MongoDB transactions. A lease fences completion;
// a stable provider key makes an uncertain retry safe inside the retry deadline.
export async function deliverAccountEmail(db: Db, id: string, key: string, send: (payload: MailPayload, idempotencyKey: string) => Promise<string>) {
  if (!ObjectId.isValid(id)) return;
  const jobs = db.collection<EmailJob>("background_jobs");
  const now = new Date();
  const leaseToken = randomUUID();
  const job = await jobs.findOneAndUpdate({ _id: new ObjectId(id), kind: "email", weddingId: null,
    "email.type": { $in: ["auth_verification", "auth_reset"] }, attempts: { $lte: 5 },
    $or: [{ state: "queued", availableAt: { $lte: now } }, { state: "running", leaseUntil: { $lte: now } }],
  }, { $set: { state: "running", leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60 * 1000), updatedAt: now }, $inc: { attempts: 1 } }, { returnDocument: "after" });
  if (!job) return;
  const fence = { _id: job._id, leaseToken, state: "running" as const, leaseUntil: { $gt: new Date() } };
  const terminal = { leaseToken: null, leaseUntil: null, updatedAt: now, finishedAt: now, purgeAt: new Date(now.getTime() + 7 * 86400000), "email.payloadCiphertext": null };
  if (job.attempts > 5) {
    await jobs.updateOne(fence, { $set: { ...terminal, state: "failed", lastErrorCode: "EMAIL_ATTEMPTS_EXHAUSTED", "email.evidence.failedAt": now } });
    return;
  }
  if (job.email.retryDeadlineAt <= now || !job.email.payloadCiphertext) {
    await jobs.updateOne(fence, { $set: { ...terminal, state: "cancelled", lastErrorCode: "AUTH_LINK_EXPIRED" } });
    return;
  }
  try {
    await jobs.updateOne(fence, { $set: { "email.firstAttemptAt": job.email.firstAttemptAt ?? now } });
    const providerId = await send(decryptMail(job.email.payloadCiphertext, key), job.email.idempotencyKey);
    await jobs.updateOne({ ...fence, leaseUntil: { $gt: new Date() } }, { $set: { ...terminal, state: "succeeded", "email.providerMessageId": providerId, "email.evidence.acceptedAt": new Date() } });
  } catch {
    const failed = job.attempts >= 5;
    await jobs.updateOne({ ...fence, leaseUntil: { $gt: new Date() } }, { $set: { ...(failed ? terminal : {}), state: failed ? "failed" : "queued", leaseToken: null, leaseUntil: null,
      availableAt: new Date(Date.now() + Math.min(300000, 30000 * 2 ** job.attempts)), updatedAt: new Date(), lastErrorCode: "EMAIL_DELIVERY_UNAVAILABLE", ...(failed ? { "email.evidence.failedAt": new Date() } : {}) } });
  }
}

export async function processAccountEmail(id: string) {
  const config = getMailConfig();
  await deliverAccountEmail(await getDatabase(), id, config.encryptionKey, async (payload, idempotencyKey) => {
    const result = await new Resend(config.apiKey).emails.send(payload, { idempotencyKey });
    if (result.error || !result.data) throw new Error("Email provider unavailable");
    return result.data.id;
  });
}

export async function dueAccountEmails() {
  const now = new Date();
  return (await getDatabase()).collection<EmailJob>("background_jobs").find({ kind: "email", weddingId: null,
    "email.type": { $in: ["auth_verification", "auth_reset"] }, attempts: { $lte: 5 },
    $or: [{ state: "queued", availableAt: { $lte: now } }, { state: "running", leaseUntil: { $lte: now } }],
  }, { projection: { _id: 1 } }).limit(25).toArray();
}
