import "server-only";
import { createHash, createHmac } from "node:crypto";
import { MongoServerError, type Db } from "mongodb";
import { getWeddingEncryptionKey } from "@/modules/weddings/server/config";
import { ApiError } from "@/server/http/errors";
const ready = new WeakMap<Db,Promise<unknown>>();
export async function admitGuestAccess(db: Db, headers: Headers, token: unknown) {
  return admit(db,headers,"guest_access",typeof token === "string" ? token : "invalid");
}
export async function admitGuestRsvp(db: Db, headers: Headers, subject: string) {
  return admit(db,headers,"guest_rsvp",subject);
}
export async function admitMemberRsvp(db: Db, accountId: string, weddingId: string) {
  // Shared across PUT/PATCH and all guests, so changing endpoints or targets cannot reset admission.
  const hash = (subject: string[]) => createHash("sha256").update(JSON.stringify(subject)).digest("hex");
  return admitBuckets(db,[
    { action: "member_rsvp_actor",scopeHash: hash([weddingId,accountId]),max: 20 },
    { action: "member_rsvp_wedding",scopeHash: hash([weddingId]),max: 60 },
  ]);
}
export async function admitGuestImport(db: Db, accountId: string, weddingId: string) {
  const hash=(ids:string[])=>createHash("sha256").update(JSON.stringify(ids)).digest("hex");
  return admitBuckets(db,[{action:"guest_import_actor",scopeHash:hash([weddingId,accountId]),max:20},{action:"guest_import_wedding",scopeHash:hash([weddingId]),max:60}]);
}
async function admit(db: Db, headers: Headers, family: "guest_access"|"guest_rsvp", subjectValue: string) {
  const secret = Buffer.from(getWeddingEncryptionKey(),"hex"), trusted = process.env.AUTH_TRUSTED_IP_HEADER;
  const ip = trusted ? (headers.get(trusted) ?? "unknown").slice(0,200) : "shared-local";
  const buckets = [[`${family}_ip`,ip,60],[family === "guest_access" ? "guest_access_token" : "guest_rsvp_grant",subjectValue,20]] as const;
  return admitBuckets(db,buckets.map(([action,subject,max]) => ({
    action,scopeHash: createHmac("sha256",secret).update(`kalyanapura:rate:${action}:${subject}`).digest("hex"),max,
  })));
}
async function admitBuckets(db: Db, buckets: { action: string; scopeHash: string; max: number }[]) {
  const limits = db.collection("rate_limits");
  let setup = ready.get(db);
  if (!setup) { setup = Promise.all([
    limits.createIndex({ key: 1 },{ unique: true,name: "rate_limits_key_uidx" }),
    limits.createIndex({ bucketKey: 1 },{ unique: true,name: "guest_access_bucket_uidx",partialFilterExpression: { bucketKey: { $type: "string" } } }),
    limits.createIndex({ purgeAt: 1 },{ expireAfterSeconds: 0 }),
  ]).catch(error => { ready.delete(db); throw error; }); ready.set(db,setup); }
  await setup;
  const now = Date.now(), starts = Math.floor(now/60000)*60000;
  for (const { action,scopeHash,max } of buckets) {
    const bucketKey = `${action}:${scopeHash}:${starts}`, filter = { key: bucketKey,bucketKey,count: { $lt: max } };
    try {
      await limits.updateOne(filter,{ $inc: { count: 1 },$setOnInsert: { bucketKey,scopeHash,action,windowStartsAt: new Date(starts),windowEndsAt: new Date(starts+60000),createdAt: new Date(now),purgeAt: new Date(starts+3600000) } },{ upsert: true });
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
      const retry = await limits.updateOne(filter,{ $inc: { count: 1 } });
      if (retry.modifiedCount !== 1) throw new ApiError(429,"RATE_LIMITED","Too many attempts. Please wait before trying again.",{ retryAfterSeconds: Math.max(1,Math.ceil((starts+60000-now)/1000)) });
    }
  }
}
