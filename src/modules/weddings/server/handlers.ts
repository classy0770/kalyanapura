import "server-only";
import { requireRequestAccount as account, readProductJson as json } from "@/server/http/member-request";
import { getEventLimit } from "@/modules/events/server/config";
import { errorResponse } from "@/server/http/errors";
import { createRequestId, resourceResponse } from "@/server/http/responses";
import { getWeddingService } from "./service";
export async function handleCreateWedding(request: Request) {
  const id = createRequestId();
  try { const user = await account(request); const input = await json(request); const result = await (await getWeddingService()).create(user, input); return resourceResponse(result, id, { status: 201, location: `/api/v1/weddings/${result.wedding.id}`, version: result.wedding.version }); }
  catch (error) { return errorResponse(error, id); }
}
export async function handleMe(request: Request) {
  const id = createRequestId();
  try { const user = await account(request, false); const context = await (await getWeddingService()).context(user); return resourceResponse({ user, membership: context.membership, nextAction: context.nextAction, limits: { eventsPerWeddingMax: getEventLimit(), pageMax: 100, uploadBatchMax: 20, originalImageMaxBytes: 10000000 } }, id); }
  catch (error) { return errorResponse(error, id); }
}
export async function handleGetWedding(request: Request, weddingId: string) {
  const id = createRequestId();
  try { const user = await account(request); const result = await (await getWeddingService()).read(user, weddingId); return resourceResponse(result, id, { version: result.wedding.version }); }
  catch (error) { return errorResponse(error, id); }
}
