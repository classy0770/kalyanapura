import { z } from "zod";
import type { GuestInvitation } from "./invitation-contract";

export const guestRsvpSchema = z.strictObject({
  invitationContext: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  status: z.enum(["attending", "not_attending"]),
  partySize: z.number().int().min(0).max(100),
}).refine(value => value.status === "attending" ? value.partySize >= 1 : value.partySize === 0, {
  path: ["partySize"], message: "Choose at least one person when attending, or zero when declining.",
});
export type GuestRsvpInput = z.infer<typeof guestRsvpSchema>;
export type SavedGuestRsvp = { version: number; rsvp: GuestInvitation["guest"]["rsvp"]; capabilities: { canRespond: boolean; canAttend: boolean } };
export type RsvpOverview = { guestCount: number; respondedGuestCount: number; attending: number; notAttending: number; pending: number; expectedAttendees: number };
