import "server-only";
import { MongoServerError, type Db, type ObjectId } from "mongodb";
import type { GuestInput } from "../schemas";
export type StoredGuest = Omit<GuestInput,"email"|"invitedEventIds"> & { _id: ObjectId; weddingId: ObjectId; emailNormalized: string|null; nameNormalized: string; invitedEventIds: ObjectId[]; schemaVersion: number; version: number; importRequestId?: string; importRowNumber?: number; createdByUserId: string; createdAt: Date; updatedAt: Date; invitation: { enabled: boolean; issuedAt: Date; tokenVersion: number; tokenHash: string; tokenCiphertext: { keyId: string; iv: string; ciphertext: string; tag: string } }; rsvp: { status: "pending"|"attending"|"not_attending"; partySize: number; respondedAt: Date|null; updatedByKind: "guest"|"member"|null; updatedByUserId: string|null } };
export const guestProjection = { _id: 1, name: 1, emailNormalized: 1, phone: 1, maxPartySize: 1, invitedEventIds: 1, notes: 1, version: 1, createdAt: 1, updatedAt: 1, "rsvp.status": 1, "rsvp.partySize": 1, "rsvp.respondedAt": 1, "rsvp.updatedByKind": 1, "rsvp.updatedByUserId": 1, "invitation.enabled": 1, "invitation.issuedAt": 1, "invitation.tokenVersion": 1 };
export function guestRepository(db: Db) { return db.collection<StoredGuest>("guests"); }
export async function prepareGuestStorage(db: Db) {
  const nullableString = { bsonType: ["string","null"] };
  try { await db.createCollection("guests", { validator: { $and: [
    { $jsonSchema: { bsonType: "object", required: ["_id","weddingId","name","nameNormalized","emailNormalized","phone","maxPartySize","invitedEventIds","notes","schemaVersion","version","createdByUserId","createdAt","updatedAt","invitation","rsvp"], properties: {
      _id: { bsonType: "objectId" }, weddingId: { bsonType: "objectId" }, schemaVersion: { enum: [1] }, version: { bsonType: "int", minimum: 1 }, name: { bsonType: "string", minLength: 1, maxLength: 150 }, nameNormalized: { bsonType: "string" }, emailNormalized: { ...nullableString, maxLength: 254 }, phone: { ...nullableString, maxLength: 50 }, notes: { ...nullableString, maxLength: 5000 }, maxPartySize: { bsonType: "int", minimum: 1, maximum: 100 }, invitedEventIds: { bsonType: "array", uniqueItems: true, maxItems: 100, items: { bsonType: "objectId" } }, importRequestId: { bsonType: "string" }, importRowNumber: { bsonType: "int", minimum: 1, maximum: 1000 }, createdByUserId: { bsonType: "string" }, createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" },
      invitation: { bsonType: "object", required: ["tokenHash","tokenCiphertext","tokenVersion","enabled","issuedAt"], properties: { tokenHash: { bsonType: "string", pattern: "^[0-9a-f]{64}$" }, tokenCiphertext: { bsonType: "object", required: ["keyId","iv","ciphertext","tag"], properties: { keyId: { bsonType: "string" }, iv: { bsonType: "string" }, ciphertext: { bsonType: "string" }, tag: { bsonType: "string" } } }, tokenVersion: { bsonType: "int", minimum: 1 }, enabled: { bsonType: "bool" }, issuedAt: { bsonType: "date" } } },
      rsvp: { bsonType: "object", required: ["status","partySize","respondedAt","updatedByKind","updatedByUserId"], properties: { status: { enum: ["pending","attending","not_attending"] }, partySize: { bsonType: "int", minimum: 0 }, respondedAt: { bsonType: ["date","null"] }, updatedByKind: { enum: [null,"guest","member"] }, updatedByUserId: nullableString } },
    } } },
    { $expr: { $cond: [{ $eq: ["$rsvp.status","attending"] }, { $and: [{ $gte: ["$rsvp.partySize",1] },{ $lte: ["$rsvp.partySize","$maxPartySize"] }] }, { $eq: ["$rsvp.partySize",0] }] } },
    { $expr: { $eq: [{ $eq: [{ $type: "$importRequestId" },"missing"] },{ $eq: [{ $type: "$importRowNumber" },"missing"] }] } },
  ] } }); } catch (error) { if (!(error instanceof MongoServerError && error.code === 48)) throw error; }
  const guests = guestRepository(db);
  await guests.createIndex({ weddingId: 1,importRequestId: 1,importRowNumber: 1 },{ unique: true,name: "uq_guest_import_row",partialFilterExpression: { importRequestId: { $type: "string" },importRowNumber: { $type: "int" } } });
  await guests.createIndex({ weddingId: 1, nameNormalized: 1, _id: 1 }, { name: "guests_name" });
  await guests.createIndex({ weddingId: 1, "rsvp.status": 1, nameNormalized: 1, _id: 1 }, { name: "guests_response" });
  await guests.createIndex({ weddingId: 1, invitedEventIds: 1, _id: 1 }, { name: "guests_events" });
  await guests.createIndex({ "invitation.tokenHash": 1 }, { unique: true, name: "guests_token" });
}
