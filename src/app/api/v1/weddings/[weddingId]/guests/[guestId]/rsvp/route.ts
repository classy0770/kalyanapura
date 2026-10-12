import { handleMemberRsvp } from "@/modules/guests/server/handlers";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ weddingId: string; guestId: string }> }) {
  const { weddingId,guestId } = await context.params;
  return handleMemberRsvp(request,weddingId,guestId);
}
