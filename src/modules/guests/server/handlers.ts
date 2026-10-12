import "server-only";
import { createRequestId, listResponse, resourceResponse } from "@/server/http/responses";
import { errorResponse } from "@/server/http/errors";
import { expectedVersion, readProductJson, requireRequestAccount } from "@/server/http/member-request";
import { getGuestService } from "./service";
export async function handleGuests(request: Request, weddingId: string) {
  const id = createRequestId();
  try {
    const account = await requireRequestAccount(request);
    if (request.method === "POST") { const input = await readProductJson(request), result = await (await getGuestService()).create(account,weddingId,input); return resourceResponse(result,id,{ status: 201,location: `/api/v1/weddings/${weddingId}/guests/${result.id}`,version: result.version }); }
    const result = await (await getGuestService()).list(account,weddingId,new URL(request.url).searchParams);
    return listResponse(result.data,result.page,id);
  } catch (error) { return errorResponse(error,id); }
}
export async function handleGuest(request: Request, weddingId: string, guestId: string) {
  const id = createRequestId();
  try { const account = await requireRequestAccount(request), input = request.method === "PATCH" ? await readProductJson(request) : undefined, service = await getGuestService();
    const result = request.method === "PATCH" ? await service.patch(account,weddingId,guestId,input,() => expectedVersion(request)) : await service.read(account,weddingId,guestId);
    return resourceResponse(result,id,{ version: result.version });
  } catch (error) { return errorResponse(error,id); }
}
export async function handleMemberRsvp(request: Request, weddingId: string, guestId: string) {
  const id = createRequestId();
  try {
    const account = await requireRequestAccount(request), input = await readProductJson(request);
    const result = await (await getGuestService()).correctRsvp(account,weddingId,guestId,input,() => expectedVersion(request));
    return resourceResponse(result,id,{ version: result.version });
  } catch (error) { return errorResponse(error,id); }
}
