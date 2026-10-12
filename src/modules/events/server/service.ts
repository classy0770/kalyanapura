import "server-only";
import { Long, ObjectId, type ClientSession, type Db, type Filter, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "@/server/db/connection";
import { ApiError } from "@/server/http/errors";
import type { Account } from "@/modules/weddings/server/service";
import { eventCreateSchema, eventPatchSchema, type WeddingEvent } from "../schemas";
import { eventProjection, eventRepository, prepareEventStorage, type StoredEvent } from "./repository";
import { getEventLimit } from "./config";
import { decodeEventCursor, encodeEventCursor } from "./cursor";

function objectId(value: string) { if (!/^[0-9a-f]{24}$/i.test(value)) throw new ApiError(400,"INVALID_ID","Invalid resource ID."); return new ObjectId(value); }
function project(value: StoredEvent): WeddingEvent {
  return { id: value._id.toHexString(), weddingId: value.weddingId.toHexString(), name: value.name, type: value.type, startsAt: value.startsAt.toISOString(), endsAt: value.endsAt?.toISOString() ?? null, venueName: value.venueName, address: value.address, description: value.description, dressCode: value.dressCode, coverPhotoId: value.coverPhotoId?.toHexString() ?? null, isPublic: value.isPublic, version: value.version, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() };
}
function validation(error: { issues: { path: PropertyKey[]; code: string; message: string }[] }) { return new ApiError(422,"VALIDATION_FAILED","Check your event details.",{ fields: error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code, message: issue.message })) }); }
export function createEventService(db: Db, client: MongoClient, capacity = getEventLimit) {
  const events = eventRepository(db);
  let prepared: Promise<void> | undefined;
  async function access(account: Account, weddingId: string, session?: ClientSession) {
    if (!account.emailVerified) throw new ApiError(403,"EMAIL_NOT_VERIFIED","Verify your email first.");
    const wedding = objectId(weddingId);
    const member = await db.collection("wedding_members").findOne({ userId: account.id, weddingId: wedding, status: "active" }, { session, projection: { _id: 1 } });
    if (!member) throw new ApiError(404,"NOT_FOUND","Wedding not found.");
    const active = await db.collection("weddings").findOne({ _id: wedding, status: "active" }, { session, projection: { _id: 1 } });
    if (!active) throw new ApiError(404,"NOT_FOUND","Wedding not found.");
    return wedding;
  }
  async function target(account: Account, weddingId: string, eventId: string, session?: ClientSession) {
    const wedding = await access(account,weddingId,session);
    const event = await events.findOne({ _id: objectId(eventId), weddingId: wedding, status: "active" }, { session, projection: eventProjection });
    if (!event) throw new ApiError(404,"NOT_FOUND","Event not found.");
    return event;
  }
  async function transaction<T>(account: Account, weddingId: string, work: (wedding: ObjectId, session: ClientSession) => Promise<T>) {
    const wedding = await access(account,weddingId);
    const session = client.startSession();
    try {
      return await session.withTransaction(async () => {
        const fenced = await db.collection("weddings").findOneAndUpdate({ _id: wedding, status: "active" }, { $inc: { writeFence: Long.ONE } }, { session, projection: { _id: 1 } });
        if (!fenced) throw new ApiError(404,"NOT_FOUND","Wedding not found.");
        await access(account,weddingId,session);
        return work(wedding,session);
      }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 5000, timeoutMS: 10000 });
    } finally { await session.endSession(); }
  }
  async function cover(id: string | null | undefined, wedding: ObjectId, event: ObjectId, session: ClientSession) {
    if (!id) return;
    const photo = await db.collection("photos").findOne({ _id: objectId(id), weddingId: wedding, eventId: event, kind: "event_cover", status: "ready" }, { session, projection: { _id: 1 } });
    if (!photo) throw new ApiError(422,"VALIDATION_FAILED","Choose a ready cover belonging to this event.",{ fields: [{ path: "coverPhotoId", code: "invalid_reference", message: "Cover must belong to this event." }] });
  }
  return {
    async list(account: Account, weddingId: string, params = new URLSearchParams()) {
      const wedding = await access(account,weddingId);
      for (const name of params.keys()) if (!["limit","cursor","public"].includes(name) || params.getAll(name).length !== 1) throw new ApiError(400,"INVALID_QUERY","Use supported event filters once.");
      const limitText = params.get("limit") ?? "25", visibilityText = params.get("public");
      if (!/^[1-9]\d*$/.test(limitText) || Number(limitText) > 100 || (visibilityText !== null && !["true","false"].includes(visibilityText))) throw new ApiError(400,"INVALID_QUERY","Invalid event list filters.");
      const limit = Number(limitText), visibility = visibilityText === null ? null : visibilityText === "true";
      const filter: Filter<StoredEvent> = { weddingId: wedding, status: "active", ...(visibility === null ? {} : { isPublic: visibility }) };
      if (params.has("cursor")) {
        const cursor = decodeEventCursor(params.get("cursor")!,wedding.toHexString(),visibility), date = new Date(cursor.startsAt);
        filter.$or = [{ startsAt: { $gt: date } }, { startsAt: date, _id: { $gt: objectId(cursor.id) } }];
      }
      const records = await events.find(filter,{ projection: eventProjection }).sort({ startsAt: 1, _id: 1 }).limit(limit+1).toArray();
      const hasMore = records.length > limit, shown = records.slice(0,limit), last = shown.at(-1);
      return { data: shown.map(project), page: { limit, hasMore, nextCursor: hasMore && last ? encodeEventCursor({ weddingId: wedding.toHexString(), public: visibility, startsAt: last.startsAt.toISOString(), id: last._id.toHexString() }) : null } };
    },
    async overview(account: Account, weddingId: string) {
      const wedding = await access(account,weddingId), filter = { weddingId: wedding, status: "active" as const };
      const count = await events.countDocuments(filter);
      const upcoming = await events.find({ ...filter, startsAt: { $gte: new Date() } }, { projection: eventProjection }).sort({ startsAt: 1, _id: 1 }).limit(3).toArray();
      return { count, upcoming: upcoming.map(project) };
    },
    async read(account: Account, weddingId: string, eventId: string) { return project(await target(account,weddingId,eventId)); },
    async create(account: Account, weddingId: string, input: unknown) {
      await access(account,weddingId);
      const parsed = eventCreateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
      const limit = capacity();
      prepared ??= prepareEventStorage(db).catch(error => { prepared = undefined; throw error; }); await prepared;
      return transaction(account,weddingId,async (wedding,session) => {
        if (await events.countDocuments({ weddingId: wedding }, { session }) >= limit) throw new ApiError(409,"EVENT_LIMIT_REACHED",`This wedding has reached its ${limit}-event limit.`);
        const id = new ObjectId(), now = new Date(); await cover(parsed.data.coverPhotoId,wedding,id,session);
        const event: StoredEvent = { ...parsed.data, _id: id, weddingId: wedding, startsAt: new Date(parsed.data.startsAt), endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null, coverPhotoId: parsed.data.coverPhotoId ? objectId(parsed.data.coverPhotoId) : null, schemaVersion: 1, version: 1, status: "active", deletionStartedAt: null, createdByUserId: account.id, createdAt: now, updatedAt: now };
        await events.insertOne(event,{ session }); return project(event);
      });
    },
    async patch(account: Account, weddingId: string, eventId: string, input: unknown, version: () => number) {
      await target(account,weddingId,eventId);
      const expected = version();
      const parsed = eventPatchSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
      return transaction(account,weddingId,async (wedding,session) => {
        const current = await target(account,weddingId,eventId,session);
        if (current.version !== expected) throw new ApiError(412,"VERSION_CONFLICT","This event changed. Reload its latest details before editing.",{ currentVersion: current.version });
        // Validate combined dates without sending resource metadata through a strict input schema.
        const { name,type,startsAt,endsAt,venueName,address,description,dressCode,coverPhotoId,isPublic } = { ...project(current), ...parsed.data };
        const combined = eventCreateSchema.safeParse({ name,type,startsAt,endsAt,venueName,address,description,dressCode,coverPhotoId,isPublic });
        if (!combined.success) throw validation(combined.error);
        await cover(parsed.data.coverPhotoId,wedding,current._id,session);
        const updated = await events.findOneAndUpdate({ _id: current._id, weddingId: wedding, status: "active", version: expected }, { $set: { ...combined.data, startsAt: new Date(combined.data.startsAt), endsAt: combined.data.endsAt ? new Date(combined.data.endsAt) : null, coverPhotoId: combined.data.coverPhotoId ? objectId(combined.data.coverPhotoId) : null, updatedAt: new Date() }, $inc: { version: 1 } }, { session, returnDocument: "after", projection: eventProjection });
        if (!updated) throw new ApiError(412,"VERSION_CONFLICT","Reload the latest event details.");
        return project(updated);
      });
    },
  };
}
let instance: Promise<ReturnType<typeof createEventService>> | undefined;
export function getEventService() { instance ??= (async () => createEventService(await getDatabase(),await getMongoClient()))().catch(error => { instance = undefined; throw error; }); return instance; }
