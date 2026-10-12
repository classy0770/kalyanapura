import "server-only";
import { createRequestId, listResponse, resourceResponse } from "@/server/http/responses";
import { errorResponse } from "@/server/http/errors";
import { expectedVersion, readProductJson, requireRequestAccount } from "@/server/http/member-request";
import { getEventService } from "./service";

export async function handleEvents(request: Request, weddingId: string) {
  const id = createRequestId();
  try {
    const account = await requireRequestAccount(request);
    if (request.method === "POST") {
      const input = await readProductJson(request), service = await getEventService(), result = await service.create(account,weddingId,input);
      return resourceResponse(result,id,{ status: 201, location: `/api/v1/weddings/${weddingId}/events/${result.id}`, version: result.version });
    }
    const result = await (await getEventService()).list(account,weddingId,new URL(request.url).searchParams);
    return listResponse(result.data,result.page,id);
  } catch (error) { return errorResponse(error,id); }
}
export async function handleEvent(request: Request, weddingId: string, eventId: string) {
  const id = createRequestId();
  try {
    const account = await requireRequestAccount(request);
    const input = request.method === "PATCH" ? await readProductJson(request) : undefined;
    const service = await getEventService();
    const result = request.method === "PATCH" ? await service.patch(account,weddingId,eventId,input,() => expectedVersion(request)) : await service.read(account,weddingId,eventId);
    return resourceResponse(result,id,{ version: result.version });
  } catch (error) { return errorResponse(error,id); }
}
