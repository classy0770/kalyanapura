import "server-only";
import { errorResponse } from "@/server/http/errors";
import { expectedVersion, readProductJson } from "@/server/http/member-request";
import { createRequestId, resourceResponse } from "@/server/http/responses";
import { readGuestGrant } from "./guest-access";
import { getRsvpService } from "./rsvp-service";

export async function handleGuestRsvp(request: Request) {
  const id = createRequestId();
  try {
    readGuestGrant(request.headers);
    const input = await readProductJson(request);
    const saved = await (await getRsvpService()).save(request.headers,input,() => expectedVersion(request));
    return resourceResponse(saved,id,{ version: saved.version });
  } catch (error) { return errorResponse(error,id); }
}
