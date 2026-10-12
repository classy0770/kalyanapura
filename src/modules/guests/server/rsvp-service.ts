import "server-only";
import { timingSafeEqual } from "node:crypto";
import { Long, ObjectId, type Db, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "@/server/db/connection";
import { ApiError } from "@/server/http/errors";
import { guestRsvpSchema, type SavedGuestRsvp } from "../rsvp-contract";
import { guestInvitationContext, readGuestGrant } from "./guest-access";
import { guestRepository } from "./repository";
import { admitGuestRsvp } from "./access-limiter";

export function createRsvpService(db: Db, client: MongoClient) {
  return {
    async save(headers: Headers, input: unknown, expectedVersion: () => number): Promise<SavedGuestRsvp> {
      const grant = readGuestGrant(headers), weddingId = new ObjectId(grant.weddingId);
      const filter = { _id: new ObjectId(grant.guestId), weddingId, "invitation.enabled": true, "invitation.tokenVersion": grant.tokenVersion };
      const unavailable = () => new ApiError(404,"LINK_UNAVAILABLE","This invitation is unavailable. Ask the family for a current link.");
      // Resolve access before revealing input/revision errors. Recheck under the fence.
      if (!await guestRepository(db).findOne(filter,{ projection: { _id: 1 } }) || !await db.collection("weddings").findOne({ _id: weddingId,status: "active" },{ projection: { _id: 1 } })) throw unavailable();
      await admitGuestRsvp(db,headers,`${grant.weddingId}:${grant.guestId}:${grant.tokenVersion}`);
      const parsed = guestRsvpSchema.safeParse(input);
      if (!parsed.success) throw new ApiError(422,"VALIDATION_FAILED","Check your response.",{ fields: parsed.error.issues.map(issue => ({ path: issue.path.join("."),code: issue.code,message: issue.message })) });
      const { invitationContext,...answer } = parsed.data;
      if (!timingSafeEqual(Buffer.from(invitationContext),Buffer.from(guestInvitationContext(grant)))) throw new ApiError(409,"INVITATION_CONTEXT_CHANGED","This browser opened a different invitation. Load the latest invitation and check its name before saving.");
      const expected = expectedVersion(), session = client.startSession();
      try {
        return await session.withTransaction(async () => {
          readGuestGrant(headers); // Expiry is checked again on transaction retries.
          const fenced = await db.collection("weddings").findOneAndUpdate({ _id: weddingId,status: "active" },{ $inc: { writeFence: Long.ONE } },{ session,projection: { _id: 1 } });
          if (!fenced) throw unavailable();
          const guests = guestRepository(db), current = await guests.findOne(filter,{ session,projection: { version: 1,maxPartySize: 1,invitedEventIds: 1,rsvp: 1 } });
          if (!current) throw unavailable();
          const canAttend = !!await db.collection("events").findOne({ _id: { $in: current.invitedEventIds },weddingId,status: "active" },{ session,projection: { _id: 1 } });
          const project = (version: number, rsvp: typeof current.rsvp): SavedGuestRsvp => ({ version,rsvp: { status: rsvp.status,partySize: rsvp.partySize,respondedAt: rsvp.respondedAt?.toISOString() ?? null },capabilities: { canRespond: true,canAttend } });
          if (current.rsvp.status === answer.status && current.rsvp.partySize === answer.partySize) return project(current.version,current.rsvp);
          if (current.version !== expected) throw new ApiError(412,"VERSION_CONFLICT","Your invitation changed. Load the latest response before saving.",{ currentVersion: current.version });
          if (answer.partySize > current.maxPartySize) throw new ApiError(422,"VALIDATION_FAILED","The party size exceeds your invitation allocation.",{ fields: [{ path: "partySize",code: "too_big",message: `Choose no more than ${current.maxPartySize} people.` }] });
          if (answer.status === "attending" && !canAttend) throw new ApiError(409,"NO_ACTIVE_INVITED_EVENTS","There are no active invited events. Your previous response is unchanged.");
          const now = new Date(), rsvp = { ...answer,respondedAt: now,updatedByKind: "guest" as const,updatedByUserId: null };
          const updated = await guests.findOneAndUpdate({ ...filter,version: expected },{ $set: { rsvp,updatedAt: now },$inc: { version: 1 } },{ session,returnDocument: "after",projection: { version: 1,rsvp: 1 } });
          if (!updated) throw new ApiError(412,"VERSION_CONFLICT","Load the latest response before saving.");
          return project(updated.version,updated.rsvp);
        },{ readPreference: "primary",readConcern: { level: "snapshot" },writeConcern: { w: "majority" },maxCommitTimeMS: 5000,timeoutMS: 10000 });
      } finally { await session.endSession(); }
    },
  };
}
export async function getRsvpService() { return createRsvpService(await getDatabase(),await getMongoClient()); }
