import { handleEvents } from "@/modules/events/server/handlers";
export const runtime = "nodejs";
async function handler(request: Request, context: { params: Promise<{ weddingId: string }> }) { return handleEvents(request,(await context.params).weddingId); }
export { handler as GET, handler as POST };
