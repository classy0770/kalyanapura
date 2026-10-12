import "server-only";
import { z } from "zod";
import { CapabilityConfigurationError } from "@/server/config";
export function getWeddingEncryptionKey(): string {
  const result = z.string().regex(/^[0-9a-f]{64}$/i).safeParse(process.env.WEDDING_GALLERY_ENCRYPTION_KEY);
  if (!result.success) throw new CapabilityConfigurationError("Wedding private settings encryption");
  return result.data;
}
