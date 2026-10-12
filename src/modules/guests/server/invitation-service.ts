import "server-only";
import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { getDatabase } from "@/server/db/connection";
import { ApiError } from "@/server/http/errors";
import type { StoredWedding } from "@/modules/weddings/server/documents";
import { eventRepository } from "@/modules/events/server/repository";
import { guestRepository } from "./repository";
import { guestInvitationContext, readGuestGrant, type GuestGrant } from "./guest-access";
import type { GuestInvitation } from "../invitation-contract";
import { admitGuestAccess } from "./access-limiter";

function unavailable(): never { throw new ApiError(404,"LINK_UNAVAILABLE","This invitation is unavailable. Ask the family for a current link."); }
export function createInvitationService(db: Db) {
  const guests = guestRepository(db);
  async function wedding(id: ObjectId) {
    const value = await db.collection<StoredWedding>("weddings").findOne({ _id: id,status: "active" },{ projection: { brideName: 1,groomName: 1,title: 1,description: 1,weddingDate: 1,location: 1,timezone: 1,"livestream.youtubeVideoId": 1 } });
    if (!value) unavailable(); return value;
  }
  return {
    async exchange(input: unknown, headers = new Headers()): Promise<Omit<GuestGrant,"expiresAt">> {
      await admitGuestAccess(db,headers,typeof input === "object" && input !== null && "token" in input ? input.token : null);
      const parsed = z.strictObject({ source: z.literal("invitation"),token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).safeParse(input);
      if (!parsed.success) unavailable();
      const bytes = Buffer.from(parsed.data.token,"base64url");
      if (bytes.length !== 32 || bytes.toString("base64url") !== parsed.data.token) unavailable();
      const guest = await guests.findOne({ "invitation.tokenHash": createHash("sha256").update(parsed.data.token).digest("hex"),"invitation.enabled": true },{ projection: { _id: 1,weddingId: 1,"invitation.tokenVersion": 1 } });
      if (!guest) unavailable(); await wedding(guest.weddingId);
      return { source: "invitation",weddingId: guest.weddingId.toHexString(),guestId: guest._id.toHexString(),tokenVersion: guest.invitation.tokenVersion };
    },
    async invitation(headers: Headers): Promise<GuestInvitation> {
      const grant = readGuestGrant(headers), weddingId = new ObjectId(grant.weddingId);
      const guest = await guests.findOne({ _id: new ObjectId(grant.guestId),weddingId,"invitation.enabled": true,"invitation.tokenVersion": grant.tokenVersion },{ projection: { name: 1,maxPartySize: 1,version: 1,invitedEventIds: 1,"rsvp.status": 1,"rsvp.partySize": 1,"rsvp.respondedAt": 1 } });
      if (!guest) unavailable();
      const value = await wedding(weddingId);
      const events = await eventRepository(db).find({ _id: { $in: guest.invitedEventIds },weddingId,status: "active" },{ projection: { name: 1,type: 1,startsAt: 1,endsAt: 1,venueName: 1,address: 1,description: 1,dressCode: 1 } }).sort({ startsAt: 1,_id: 1 }).toArray();
      const youtube = value.livestream?.youtubeVideoId;
      return {
        invitationContext: guestInvitationContext(grant),
        wedding: { brideName: value.brideName,groomName: value.groomName,title: value.title,description: value.description,weddingDate: value.weddingDate,location: value.location,timezone: value.timezone,cover: null },
        guest: { name: guest.name,maxPartySize: guest.maxPartySize,version: guest.version,rsvp: { status: guest.rsvp.status,partySize: guest.rsvp.partySize,respondedAt: guest.rsvp.respondedAt?.toISOString() ?? null } },
        events: events.map(event => ({ id: event._id.toHexString(),name: event.name,type: event.type,startsAt: event.startsAt.toISOString(),endsAt: event.endsAt?.toISOString() ?? null,venueName: event.venueName,address: event.address,description: event.description,dressCode: event.dressCode,cover: null })),
        capabilities: { canRespond: true,canAttend: events.length > 0,canViewGallery: false,canUploadPhotos: false,reasons: ["GALLERY_NOT_AVAILABLE",...(events.length ? [] : ["NO_ACTIVE_INVITED_EVENTS"])] },
        livestream: youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube) ? { embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}` } : null,
      };
    },
  };
}
export async function getInvitationService() { return createInvitationService(await getDatabase()); }
