import { handleGuests } from "@/modules/guests/server/handlers";
export const runtime = "nodejs";
type Context = { params: Promise<{ weddingId: string }> };
export async function GET(request: Request, context: Context) { return handleGuests(request,(await context.params).weddingId); }
export async function POST(request: Request, context: Context) { return handleGuests(request,(await context.params).weddingId); }
