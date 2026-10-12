import { z } from "zod";
const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null).nullable();
const fields = {
  name: z.string().trim().min(1).max(150),
  email: z.union([z.string().trim().pipe(z.email().max(254)).transform(value => value.toLowerCase()), z.literal("").transform(() => null), z.null()]),
  phone: optionalText(50), maxPartySize: z.number().int().min(1).max(100),
  invitedEventIds: z.array(z.string().regex(/^[0-9a-f]{24}$/i).transform(value => value.toLowerCase())).max(100).refine(ids => new Set(ids).size === ids.length, "Choose each event only once."),
  notes: optionalText(5000),
};
export const guestCreateSchema = z.strictObject({ ...fields, email: fields.email.default(null), phone: fields.phone.default(null), maxPartySize: fields.maxPartySize.default(1), invitedEventIds: fields.invitedEventIds.default([]), notes: fields.notes.default(null) });
export const memberRsvpSchema = z.strictObject({ status: z.enum(["pending","attending","not_attending"]),partySize: z.number().int().min(0).max(100) })
  .refine(value => value.status === "attending" ? value.partySize >= 1 : value.partySize === 0,{ path: ["partySize"],message: "Attending requires at least one person; Pending and Not attending require zero." });
export const guestPatchSchema = z.strictObject({ ...fields,rsvp: memberRsvpSchema }).partial().refine(value => Object.keys(value).length > 0, "Provide at least one guest field.");
export type GuestInput = z.infer<typeof guestCreateSchema>;
export type Guest = GuestInput & { id: string; version: number; createdAt: string; updatedAt: string; invitation: { enabled: boolean; issuedAt: string; tokenVersion: number }; rsvp: { status: "pending"|"attending"|"not_attending"; partySize: number; respondedAt: string|null; updatedByKind: "guest"|"member"|null; updatedByUserId: string|null } };
export function normalizeGuestName(value: string) { return value.normalize("NFKC").trim().toLowerCase(); }
