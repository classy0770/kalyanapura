import "server-only";
import { z } from "zod";
import { ApiError, errorResponse } from "@/server/http/errors";
import { createRequestId, noContentResponse, resourceResponse } from "@/server/http/responses";
import { expectedVersion, readProductJson, requireRequestAccount } from "@/server/http/member-request";
import { clearGuestCookie, guestCookie, readGuestGrant } from "./guest-access";
import { getGuestService } from "./service";
import { getInvitationService } from "./invitation-service";

export async function handleInvitationLink(request: Request, weddingId: string, guestId: string, action: "read" | "toggle" | "replace") {
  const id = createRequestId();
  try {
    const account = await requireRequestAccount(request);
    const input = action === "read" ? undefined : await readProductJson(request,action === "replace");
    const service = await getGuestService();
    const result = action === "read" ? await service.invitationLink(account,weddingId,guestId) : await service.changeInvitation(account,weddingId,guestId,input,() => expectedVersion(request),action === "replace");
    return resourceResponse(result,id,{ version: "guestVersion" in result ? result.guestVersion : result.version });
  } catch (error) { return errorResponse(error,id); }
}
export async function handleGuestAccess(request: Request) {
  const id = createRequestId();
  try {
    const input = await readProductJson(request,true);
    if (request.method === "DELETE") {
      if (!z.strictObject({}).safeParse(input).success) throw new ApiError(422,"VALIDATION_FAILED","Use an empty request to close guest access.");
      const response = noContentResponse(id); response.headers.set("Set-Cookie",clearGuestCookie()); return response;
    }
    const service = await getInvitationService(), grant = await service.exchange(input,request.headers), cookie = guestCookie(grant);
    const view = await service.invitation(new Headers({ cookie: cookie.split(";")[0] }));
    const response = resourceResponse({ source: "invitation",capabilities: view.capabilities },id);
    response.headers.set("Set-Cookie",cookie); return response;
  } catch (error) {
    const response = errorResponse(error,id);
    if (error instanceof ApiError && error.code === "LINK_UNAVAILABLE") response.headers.set("Set-Cookie",clearGuestCookie());
    return response;
  }
}
export async function handleGuestInvitation(request: Request) {
  const id = createRequestId();
  try { readGuestGrant(request.headers); const view = await (await getInvitationService()).invitation(request.headers); return resourceResponse(view,id,{ version: view.guest.version }); }
  catch (error) { return errorResponse(error,id); }
}
