import { handleGuest } from "@/modules/guests/server/handlers";
export const runtime = "nodejs";
type Context = { params: Promise<{ weddingId: string; guestId: string }> };
export async function GET(request: Request, context: Context) { const { weddingId,guestId } = await context.params; return handleGuest(request,weddingId,guestId); }
export async function PATCH(request: Request, context: Context) { const { weddingId,guestId } = await context.params; return handleGuest(request,weddingId,guestId); }
