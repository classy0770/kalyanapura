import { handleInvitationLink } from "@/modules/guests/server/invitation-handlers";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ weddingId: string; guestId: string }> }) { const { weddingId,guestId } = await context.params; return handleInvitationLink(request,weddingId,guestId,"toggle"); }
