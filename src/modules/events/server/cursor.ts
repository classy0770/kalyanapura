import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/server/http/errors";
import { CapabilityConfigurationError } from "@/server/config";
type Cursor = { weddingId: string; public: boolean | null; startsAt: string; id: string };
function key() { const secret = process.env.BETTER_AUTH_SECRET; if (!secret || secret.length < 32) throw new CapabilityConfigurationError("Event cursor signing"); return createHmac("sha256", secret).update("kalyanapura:events:cursor:v1").digest(); }
function signature(value: string) { return createHmac("sha256", key()).update(value).digest(); }
export function encodeEventCursor(value: Cursor) { const payload = Buffer.from(JSON.stringify(value)).toString("base64url"); return `${payload}.${signature(payload).toString("base64url")}`; }
export function decodeEventCursor(value: string, weddingId: string, visibility: boolean | null): Cursor {
  try {
    if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const [payload, mac] = value.split("."); const supplied = Buffer.from(mac, "base64url"), expected = signature(payload);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.weddingId !== weddingId || parsed.public !== visibility || !/^[0-9a-f]{24}$/.test(parsed.id) || typeof parsed.startsAt !== "string" || new Date(parsed.startsAt).toISOString() !== parsed.startsAt) throw new Error();
    return parsed;
  } catch (error) {
    if (error instanceof CapabilityConfigurationError) throw error;
    throw new ApiError(400, "INVALID_CURSOR", "Refresh the event list to continue.");
  }
}
