import "server-only";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { Long, MongoServerError, ObjectId, type Db, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "@/server/db/connection";
import { ApiError } from "@/server/http/errors";
import { getWeddingEncryptionKey } from "./config";
import { prepareWeddingStorage, weddingRepository } from "./repository";
import type { StoredMembership, StoredWedding } from "./documents";
import { weddingInputSchema, type Membership, type Wedding, type WeddingContext } from "../schemas";

export type Account = { id: string; name: string; email: string; emailVerified: boolean };
function membershipProjection(value: StoredMembership): Membership { return { id: value._id.toHexString(), weddingId: value.weddingId.toHexString(), role: value.role, status: value.status, version: value.version, joinedAt: value.joinedAt.toISOString() }; }
function weddingProjection(value: StoredWedding): Wedding { return { id: value._id.toHexString(), brideName: value.brideName, groomName: value.groomName, weddingDate: value.weddingDate, location: value.location, title: value.title, description: value.description, timezone: value.timezone, currency: value.currency, version: value.version, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(), coverPhotoId: value.coverPhotoId?.toHexString() ?? null, website: { slug: value.website.slug, theme: value.website.theme, welcomeText: value.website.welcomeText, isPublished: value.website.isPublished, firstPublishedAt: value.website.firstPublishedAt?.toISOString() ?? null, updatedAt: value.website.updatedAt.toISOString() }, livestream: { youtubeVideoId: value.livestream.youtubeVideoId }, gallery: { guestViewEnabled: value.gallery.guestViewEnabled, guestUploadEnabled: value.gallery.guestUploadEnabled } }; }

export function createWeddingService(db: Db, client: MongoClient, encryptionKey = getWeddingEncryptionKey) {
  const repository = weddingRepository(db);
  let prepared: Promise<void> | undefined;
  async function prepare() { prepared ??= prepareWeddingStorage(db).catch(error => { prepared = undefined; throw error; }); await prepared; }
  async function context(account: Account): Promise<WeddingContext> {
    if (!account.emailVerified) return { membership: null, wedding: null, nextAction: "verify_email" };
    const member = await repository.currentMembership(account.id);
    if (!member) return { membership: null, wedding: null, nextAction: "create_or_join" };
    const membership = membershipProjection(member);
    if (member.status !== "active") return { membership, wedding: null, nextAction: "membership_cleanup" };
    const wedding = await repository.wedding(member.weddingId);
    if (!wedding) throw new ApiError(503, "TEMPORARILY_UNAVAILABLE", "Your wedding is temporarily unavailable.");
    return { membership, wedding: weddingProjection(wedding), nextAction: "dashboard" };
  }
  return {
    context,
    async read(account: Account, weddingId: string) {
      if (!account.emailVerified) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email first.");
      if (!/^[0-9a-f]{24}$/i.test(weddingId)) throw new ApiError(400, "INVALID_ID", "Invalid wedding ID.");
      const current = await context(account);
      if (!current.wedding || current.wedding.id !== weddingId.toLowerCase()) throw new ApiError(404, "NOT_FOUND", "Wedding not found.");
      return { wedding: current.wedding, membership: current.membership! };
    },
    async create(account: Account, input: unknown) {
      if (!account.emailVerified) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email first.");
      const parsed = weddingInputSchema.safeParse(input);
      if (!parsed.success) throw new ApiError(422, "VALIDATION_FAILED", "Check your wedding details.", { fields: parsed.error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code, message: issue.message })) });
      if (await repository.currentMembership(account.id)) throw new ApiError(409, "ALREADY_IN_WEDDING", "You already belong to a wedding.");
      const key = Buffer.from(encryptionKey(), "hex");
      await prepare();
      const session = client.startSession();
      try {
        return await session.withTransaction(async () => {
          const id = new ObjectId(), now = new Date();
          const token = randomBytes(32).toString("base64url"), iv = randomBytes(12);
          const cipher = createCipheriv("aes-256-gcm", key, iv);
          cipher.setAAD(Buffer.from(`weddings:${id.toHexString()}:gallery:1`));
          const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
          const wedding: StoredWedding = { ...parsed.data, _id: id, schemaVersion: 1, version: 1, createdAt: now, updatedAt: now, createdByUserId: account.id, description: null, status: "active", timezone: "Asia/Kolkata", currency: "INR", coverPhotoId: null,
            website: { slug: null, theme: "minimal_elegant", welcomeText: "", isPublished: false, firstPublishedAt: null, updatedAt: now }, livestream: { youtubeVideoId: null },
            gallery: { guestViewEnabled: true, guestUploadEnabled: true, tokenHash: createHash("sha256").update(token).digest("hex"), tokenCiphertext: { keyId: "v1", iv: iv.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") }, tokenVersion: 1, uploadPolicyVersion: 1 },
            mediaQuota: { limitBytes: Long.ZERO, usedBytes: Long.ZERO, reservedBytes: Long.ZERO }, writeFence: Long.ZERO };
          await repository.weddings.insertOne(wedding, { session });
          await repository.weddings.findOneAndUpdate({ _id: id, status: "active" }, { $inc: { writeFence: Long.ONE } }, { session });
          if (await repository.currentMembership(account.id, session)) throw new ApiError(409, "ALREADY_IN_WEDDING", "You already belong to a wedding.");
          const member: StoredMembership = { _id: new ObjectId(), weddingId: id, userId: account.id, role: "admin", status: "active", schemaVersion: 1, version: 1, joinedAt: now, invitedByUserId: null, removalStartedAt: null, createdAt: now, updatedAt: now };
          await repository.members.insertOne(member, { session });
          return { wedding: weddingProjection(wedding), membership: membershipProjection(member) };
        }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 5000, timeoutMS: 10000 });
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.userId) throw new ApiError(409, "ALREADY_IN_WEDDING", "You already belong to a wedding.");
        throw error;
      } finally { await session.endSession(); }
    },
  };
}
let instance: Promise<ReturnType<typeof createWeddingService>> | undefined;
export function getWeddingService() {
  instance ??= (async () => createWeddingService(await getDatabase(), await getMongoClient()))().catch(error => { instance = undefined; throw error; });
  return instance;
}
