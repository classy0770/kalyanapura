import "server-only";
import type { Long, ObjectId } from "mongodb";
import type { WeddingInput } from "../schemas";
type Common = { _id: ObjectId; schemaVersion: number; version: number; createdAt: Date; updatedAt: Date };
export type StoredMembership = Common & { weddingId: ObjectId; userId: string; role: "admin" | "manager"; status: "active" | "removing"; joinedAt: Date; invitedByUserId: string | null; removalStartedAt: Date | null };
export type StoredWedding = Common & WeddingInput & {
  description: string | null; createdByUserId: string; status: "active"; timezone: "Asia/Kolkata"; currency: "INR"; coverPhotoId: ObjectId | null;
  website: { slug: string | null; theme: "minimal_elegant"; welcomeText: string; isPublished: boolean; firstPublishedAt: Date | null; updatedAt: Date };
  livestream: { youtubeVideoId: string | null };
  gallery: { guestViewEnabled: boolean; guestUploadEnabled: boolean; tokenHash: string; tokenCiphertext: { keyId: string; iv: string; ciphertext: string; tag: string }; tokenVersion: number; uploadPolicyVersion: number };
  mediaQuota: { limitBytes: Long; usedBytes: Long; reservedBytes: Long }; writeFence: Long;
};
