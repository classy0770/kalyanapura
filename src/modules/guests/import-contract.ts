import { z } from "zod";
import { guestCreateSchema } from "./schemas";
export const importRowSchema = guestCreateSchema.extend({ rowNumber: z.number().int().min(1).max(1000) });
export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportPreview = { importRequestId: string; previewToken: string; expiresAt: string; rows: { rowNumber: number; values: Record<string,unknown>; errors: { path: string; message: string }[]; warnings: string[]; imported: boolean; changed: boolean }[] };
export type ImportResult = { rows: { rowNumber: number; status: "created"|"already_imported"; guestId: string }[] };
