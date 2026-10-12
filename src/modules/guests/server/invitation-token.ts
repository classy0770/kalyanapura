import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CapabilityUnavailableError } from "@/server/config";
import type { StoredGuest } from "./repository";

export function createInvitationToken(id: string, version: number, key: string) {
  const token = randomBytes(32).toString("base64url"), iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm",Buffer.from(key,"hex"),iv);
  cipher.setAAD(Buffer.from(`guests:${id}:invitation:${version}`));
  const ciphertext = Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return { tokenHash: createHash("sha256").update(token).digest("hex"),tokenCiphertext: { keyId: "v1",iv: iv.toString("base64url"),ciphertext: ciphertext.toString("base64url"),tag: cipher.getAuthTag().toString("base64url") } };
}
export function readInvitationToken(id: string, invitation: StoredGuest["invitation"], key: string) {
  try {
    const envelope = invitation.tokenCiphertext;
    if (envelope.keyId !== "v1") throw new Error();
    const decipher = createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(envelope.iv,"base64url"));
    decipher.setAAD(Buffer.from(`guests:${id}:invitation:${invitation.tokenVersion}`));
    decipher.setAuthTag(Buffer.from(envelope.tag,"base64url"));
    const token = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,"base64url")),decipher.final()]).toString("utf8");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !timingSafeEqual(createHash("sha256").update(token).digest(),Buffer.from(invitation.tokenHash,"hex"))) throw new Error();
    return token;
  } catch { throw new CapabilityUnavailableError("Guest invitation"); }
}
