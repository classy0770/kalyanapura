import { z } from "zod";

export function calendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.toISOString().slice(0, 10) === value;
}
export const weddingInputSchema = z.object({
  brideName: z.string().trim().min(1).max(150),
  groomName: z.string().trim().min(1).max(150),
  weddingDate: z.string().refine(calendarDay, "Enter a valid wedding date."),
  location: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(150).nullable().optional().default(null),
}).strict();
export type WeddingInput = z.infer<typeof weddingInputSchema>;
export type Membership = { id: string; weddingId: string; role: "admin" | "manager"; status: "active" | "removing"; version: number; joinedAt: string };
export type Wedding = WeddingInput & { id: string; description: string | null; timezone: "Asia/Kolkata"; currency: "INR"; version: number; createdAt: string; updatedAt: string; coverPhotoId: string | null; website: { slug: string | null; theme: string; welcomeText: string; isPublished: boolean; firstPublishedAt: string | null; updatedAt: string }; livestream: { youtubeVideoId: string | null }; gallery: { guestViewEnabled: boolean; guestUploadEnabled: boolean } };
export type WeddingResource = { wedding: Wedding; membership: Membership };
export type WeddingContext = { membership: Membership | null; wedding: Wedding | null; nextAction: "verify_email" | "create_or_join" | "dashboard" | "membership_cleanup" };

export function daysUntilWedding(day: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const today = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  const stamp = (value: string) => { const [year, month, date] = value.split("-").map(Number); const result = new Date(0); result.setUTCFullYear(year, month - 1, date); return result.getTime(); };
  return Math.round((stamp(day) - stamp(today)) / 86400000);
}
