import { handleEvent } from "@/modules/events/server/handlers";
export const runtime = "nodejs";
async function handler(request: Request, context: { params: Promise<{ weddingId: string; eventId: string }> }) { const params = await context.params; return handleEvent(request,params.weddingId,params.eventId); }
export { handler as GET, handler as PATCH };
