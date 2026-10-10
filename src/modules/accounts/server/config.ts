import "server-only";
import { z } from "zod";
import { CapabilityConfigurationError, getAppOrigin } from "@/server/config";

export function getAuthConfig() {
  const result = z.string().min(32).safeParse(process.env.BETTER_AUTH_SECRET);
  if (!result.success) throw new CapabilityConfigurationError("Authentication secret");
  return { origin: getAppOrigin(), secret: result.data };
}

export function getMailConfig() {
  const localWorker = process.env.INNGEST_DEV === "1" || process.env.INNGEST_DEV === "true";
  if ((process.env.NODE_ENV === "production" && localWorker) || (!localWorker && (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY))) {
    throw new CapabilityConfigurationError("Account email dispatch");
  }
  const result = z.object({
    apiKey: z.string().startsWith("re_").min(10),
    from: z.string().email(),
    encryptionKey: z.string().regex(/^[0-9a-f]{64}$/i),
  }).safeParse({ apiKey: process.env.RESEND_API_KEY, from: process.env.AUTH_EMAIL_FROM, encryptionKey: process.env.AUTH_EMAIL_ENCRYPTION_KEY });
  if (!result.success) throw new CapabilityConfigurationError("Account email");
  return result.data;
}
