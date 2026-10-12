import "server-only";
import { MongoServerError, type ClientSession, type Db } from "mongodb";
import type { StoredMembership, StoredWedding } from "./documents";

const common = { _id: { bsonType: "objectId" }, schemaVersion: { enum: [1] }, version: { bsonType: "int", minimum: 1 }, createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" } };
const commonRequired = ["_id", "schemaVersion", "version", "createdAt", "updatedAt"];
export async function prepareWeddingStorage(db: Db) {
  const definitions = [
    { name: "weddings", required: [...commonRequired, "brideName", "groomName", "weddingDate", "location", "title", "description", "createdByUserId", "status", "timezone", "currency", "coverPhotoId", "website", "livestream", "gallery", "mediaQuota", "writeFence"], properties: { ...common, brideName: { bsonType: "string", minLength: 1, maxLength: 150 }, groomName: { bsonType: "string", minLength: 1, maxLength: 150 }, weddingDate: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, location: { bsonType: "string", minLength: 1, maxLength: 500 }, title: { bsonType: ["string", "null"], maxLength: 150 }, description: { bsonType: ["string", "null"] }, createdByUserId: { bsonType: "string" }, status: { enum: ["active"] }, timezone: { enum: ["Asia/Kolkata"] }, currency: { enum: ["INR"] }, coverPhotoId: { bsonType: ["objectId", "null"] }, website: { bsonType: "object" }, livestream: { bsonType: "object" }, gallery: { bsonType: "object" }, mediaQuota: { bsonType: "object" }, writeFence: { bsonType: "long", minimum: 0 } } },
    { name: "wedding_members", required: [...commonRequired, "weddingId", "userId", "role", "status", "joinedAt", "invitedByUserId", "removalStartedAt"], properties: { ...common, weddingId: { bsonType: "objectId" }, userId: { bsonType: "string", minLength: 1 }, role: { enum: ["admin", "manager"] }, status: { enum: ["active", "removing"] }, joinedAt: { bsonType: "date" }, invitedByUserId: { bsonType: ["string", "null"] }, removalStartedAt: { bsonType: ["date", "null"] } } },
  ];
  for (const definition of definitions) {
    try { await db.createCollection(definition.name, { validator: { $jsonSchema: { bsonType: "object", required: definition.required, properties: definition.properties } } }); }
    catch (error) { if (!(error instanceof MongoServerError && error.code === 48)) throw error; }
  }
  await db.collection("wedding_members").createIndex({ userId: 1 }, { unique: true, name: "uq_wedding_member_user" });
  await db.collection("wedding_members").createIndex({ weddingId: 1, status: 1, role: 1 }, { name: "wedding_members_scope" });
  await db.collection("weddings").createIndex({ "website.slug": 1 }, { unique: true, name: "uq_website_slug", partialFilterExpression: { "website.slug": { $type: "string" } } });
  await db.collection("weddings").createIndex({ "gallery.tokenHash": 1 }, { unique: true, name: "uq_gallery_token_hash" });
}
export function weddingRepository(db: Db) {
  const members = db.collection<StoredMembership>("wedding_members");
  const weddings = db.collection<StoredWedding>("weddings");
  return {
    members, weddings,
    currentMembership: (userId: string, session?: ClientSession) => members.findOne({ userId }, { session, projection: { _id: 1, weddingId: 1, role: 1, status: 1, version: 1, joinedAt: 1 } }),
    wedding: (id: StoredWedding["_id"]) => weddings.findOne({ _id: id, status: "active" }, { projection: { _id: 1, brideName: 1, groomName: 1, weddingDate: 1, location: 1, title: 1, description: 1, timezone: 1, currency: 1, version: 1, createdAt: 1, updatedAt: 1, coverPhotoId: 1, "website.slug": 1, "website.theme": 1, "website.welcomeText": 1, "website.isPublished": 1, "website.firstPublishedAt": 1, "website.updatedAt": 1, "livestream.youtubeVideoId": 1, "gallery.guestViewEnabled": 1, "gallery.guestUploadEnabled": 1 } }),
  };
}
