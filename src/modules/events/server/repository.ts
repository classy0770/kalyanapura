import "server-only";
import { MongoServerError, type Db, type ObjectId } from "mongodb";
import type { EventInput } from "../schemas";
export type StoredEvent = Omit<EventInput,"startsAt"|"endsAt"|"coverPhotoId"> & { _id: ObjectId; weddingId: ObjectId; startsAt: Date; endsAt: Date | null; coverPhotoId: ObjectId | null; schemaVersion: number; version: number; status: "active" | "deleting"; deletionStartedAt: Date | null; createdByUserId: string; createdAt: Date; updatedAt: Date };
export const eventProjection = { _id: 1, weddingId: 1, name: 1, type: 1, startsAt: 1, endsAt: 1, venueName: 1, address: 1, description: 1, dressCode: 1, coverPhotoId: 1, isPublic: 1, version: 1, createdAt: 1, updatedAt: 1 };
export function eventRepository(db: Db) { return db.collection<StoredEvent>("events"); }
export async function prepareEventStorage(db: Db) {
  try {
    await db.createCollection("events", { validator: { $jsonSchema: { bsonType: "object", required: ["_id","weddingId","schemaVersion","version","name","type","startsAt","endsAt","venueName","address","description","dressCode","coverPhotoId","isPublic","status","deletionStartedAt","createdByUserId","createdAt","updatedAt"], properties: {
      _id: { bsonType: "objectId" }, weddingId: { bsonType: "objectId" }, schemaVersion: { enum: [1] }, version: { bsonType: "int", minimum: 1 }, name: { bsonType: "string", minLength: 1, maxLength: 150 }, type: { bsonType: "string" }, startsAt: { bsonType: "date" }, endsAt: { bsonType: ["date","null"] }, venueName: { bsonType: ["string","null"], maxLength: 500 }, address: { bsonType: ["string","null"], maxLength: 500 }, description: { bsonType: ["string","null"], maxLength: 5000 }, dressCode: { bsonType: ["string","null"], maxLength: 5000 }, coverPhotoId: { bsonType: ["objectId","null"] }, isPublic: { bsonType: "bool" }, status: { enum: ["active","deleting"] }, deletionStartedAt: { bsonType: ["date","null"] }, createdByUserId: { bsonType: "string" }, createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" },
    } } } });
  } catch (error) { if (!(error instanceof MongoServerError && error.code === 48)) throw error; }
  await eventRepository(db).createIndex({ weddingId: 1, status: 1, startsAt: 1, _id: 1 }, { name: "events_schedule" });
}
