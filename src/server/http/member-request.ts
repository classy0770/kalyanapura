import "server-only";
import { getAccount } from "@/modules/accounts/server/session";
import { getAppOrigin } from "@/server/config";
import { ApiError } from "./errors";

export async function requireRequestAccount(request: Request, verified = true) {
  if (!request.headers.get("cookie")?.includes("kalyanapura.session_token=")) throw new ApiError(401, "AUTH_REQUIRED", "Log in to continue.");
  const user = await getAccount(request.headers);
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Log in to continue.");
  if (verified && !user.emailVerified) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email first.");
  return user;
}

export async function readProductJson(request: Request, allowEmpty = false) {
  if (request.headers.get("origin") !== getAppOrigin() || request.headers.get("x-kp-request") !== "1" || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "ORIGIN_REJECTED", "This request origin is not allowed.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use JSON for this request.");
  const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 262144) { await reader.cancel(); throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request details are too large."); }
    chunks.push(value);
  }
  if (allowEmpty && bytes === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "INVALID_JSON", "Enter valid JSON details."); }
}

export function expectedVersion(request: Request): number {
  const raw = request.headers.get("x-expected-version");
  if (raw === null) throw new ApiError(428, "PRECONDITION_REQUIRED", "Reload the resource before editing it.");
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new ApiError(400, "INVALID_VERSION", "Use one positive integer version.");
  return Number(raw);
}
