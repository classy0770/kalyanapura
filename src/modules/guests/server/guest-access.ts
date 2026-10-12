import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { getAppOrigin } from "@/server/config";
import { ApiError } from "@/server/http/errors";
import { getWeddingEncryptionKey } from "@/modules/weddings/server/config";

const lifetime = 7 * 24 * 60 * 60;
const grantSchema = z.strictObject({ source: z.literal("invitation"),weddingId: z.string().regex(/^[0-9a-f]{24}$/),guestId: z.string().regex(/^[0-9a-f]{24}$/),tokenVersion: z.number().int().positive(),expiresAt: z.number().int().positive() });
export type GuestGrant = z.infer<typeof grantSchema>;
// A display binding, never an access capability. Authority still comes from the live cookie.
export function guestInvitationContext(grant: Pick<GuestGrant,"weddingId"|"guestId"|"tokenVersion">) {
  return createHmac("sha256",Buffer.from(getWeddingEncryptionKey(),"hex"))
    .update(`kalyanapura:rsvp-context:v1:${grant.weddingId}:${grant.guestId}:${grant.tokenVersion}`).digest("base64url");
}
function key() { return createHmac("sha256",Buffer.from(getWeddingEncryptionKey(),"hex")).update("kalyanapura:guest-access:v1").digest(); }
function cookieName() { return getAppOrigin().startsWith("https:") ? "__Host-kp-guest" : "kp-guest"; }
export function guestCookie(grant: Omit<GuestGrant,"expiresAt">) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm",key(),iv);
  cipher.setAAD(Buffer.from("kalyanapura:guest-access:v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ ...grant,expiresAt: Math.floor(Date.now()/1000)+lifetime }),"utf8"),cipher.final()]);
  const value = ["v1",iv.toString("base64url"),ciphertext.toString("base64url"),cipher.getAuthTag().toString("base64url")].join(".");
  return `${cookieName()}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${lifetime}${getAppOrigin().startsWith("https:") ? "; Secure" : ""}`;
}
export function clearGuestCookie() { return `${cookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${getAppOrigin().startsWith("https:") ? "; Secure" : ""}`; }
export function readGuestGrant(headers: Headers): GuestGrant {
  const name = cookieName(), matches = (headers.get("cookie") ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(name+"="));
  if (matches.length !== 1) throw new ApiError(401,"GUEST_ACCESS_REQUIRED","Open your personal invitation link to continue.");
  const cookie = matches[0].slice(name.length+1), secret = key();
  try {
    if (cookie.length > 2048 || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie)) throw new Error();
    const [,iv,value,tag] = cookie.split(".");
    if (Buffer.from(iv,"base64url").length !== 12 || Buffer.from(tag,"base64url").length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm",secret,Buffer.from(iv,"base64url"));
    decipher.setAAD(Buffer.from("kalyanapura:guest-access:v1")); decipher.setAuthTag(Buffer.from(tag,"base64url"));
    const grant = grantSchema.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(value,"base64url")),decipher.final()]).toString("utf8")));
    if (grant.expiresAt <= Math.floor(Date.now()/1000)) throw new Error();
    return grant;
  } catch { throw new ApiError(401,"GUEST_ACCESS_REQUIRED","Open your personal invitation link to continue."); }
}
