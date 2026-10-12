import { z } from "zod";
import { calendarDay } from "@/modules/weddings/schemas";

export const eventTypes = ["roka", "engagement", "mehendi", "haldi", "sangeet", "cocktail", "wedding", "reception", "custom"] as const;
const instant = z.string().refine(value => {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  return !!match && calendarDay(match[1]) && !(match[5].slice(1,3) === "14" && match[5].slice(4) !== "00") && Number.isFinite(Date.parse(value));
}, "Enter a valid date and time with an explicit UTC offset.");
const text = (max: number) => z.string().trim().max(max).nullable();
const fields = {
  name: z.string().trim().min(1).max(150), type: z.enum(eventTypes), startsAt: instant, endsAt: instant.nullable(),
  venueName: text(500), address: text(500), description: text(5000), dressCode: text(5000),
  coverPhotoId: z.string().regex(/^[0-9a-f]{24}$/i).nullable(), isPublic: z.boolean(),
};
export const eventCreateSchema = z.object({ ...fields, type: fields.type.default("custom"), endsAt: fields.endsAt.default(null), venueName: fields.venueName.default(null), address: fields.address.default(null), description: fields.description.default(null), dressCode: fields.dressCode.default(null), coverPhotoId: fields.coverPhotoId.default(null), isPublic: fields.isPublic.default(false) }).strict().refine(value => !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ["endsAt"], message: "End must be later than the start, including its date." });
export const eventPatchSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, "Choose at least one field to edit.");
export type EventInput = z.infer<typeof eventCreateSchema>;
export type WeddingEvent = EventInput & { id: string; weddingId: string; version: number; createdAt: string; updatedAt: string };

export function kolkataInput(value: string): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  const precise = date.getUTCSeconds() || date.getUTCMilliseconds() ? `:${part("second")}.${String(date.getUTCMilliseconds()).padStart(3,"0")}` : "";
  return `${part("year").padStart(4,"0")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}${precise}`;
}
export function localInstant(value: string): string { return value.length === 16 ? `${value}:00+05:30` : `${value}+05:30`; }
export function eventFormInstant(value: string, previous?: string | null): string {
  return previous && value === kolkataInput(previous).slice(0,16) ? previous : localInstant(value);
}
export function formatEventTime(value: string): string { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value)).replace(/\b(am|pm)\b/gi, part => part.toUpperCase()); }
