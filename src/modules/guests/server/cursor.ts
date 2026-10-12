import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/server/http/errors";
import { CapabilityConfigurationError } from "@/server/config";
type Cursor = { weddingId: string; filters: string; name: string; id: string };
// NFKC can expand each accepted name/search character into many characters.
// Bound the signed envelope, rather than imposing a second name validation rule.
const MAX_CURSOR_LENGTH = 64 * 1024;
function signature(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new CapabilityConfigurationError("Guest cursor signing");
  const key = createHmac("sha256",secret).update("kalyanapura:guests:cursor:v1").digest();
  return createHmac("sha256",key).update(value).digest();
}
export function encodeGuestCursor(value: Cursor) { const payload = Buffer.from(JSON.stringify(value)).toString("base64url"); return `${payload}.${signature(payload).toString("base64url")}`; }
export function decodeGuestCursor(value: string, weddingId: string, filters: string): Cursor {
  try {
    if (value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const [payload, mac] = value.split("."), supplied = Buffer.from(mac,"base64url"), expected = signature(payload);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) throw new Error();
    const parsed = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if (parsed.weddingId !== weddingId || parsed.filters !== filters || typeof parsed.name !== "string" || !/^[0-9a-f]{24}$/.test(parsed.id)) throw new Error();
    return parsed;
  } catch (error) { if (error instanceof CapabilityConfigurationError) throw error; throw new ApiError(400,"INVALID_CURSOR","Refresh the guest list to continue."); }
}
