import "server-only";
import { z } from "zod";
import { CapabilityConfigurationError } from "@/server/config";
export function getEventLimit() {
  const result = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger).safeParse(process.env.WEDDING_EVENT_LIMIT ?? "25");
  if (!result.success) throw new CapabilityConfigurationError("Wedding event capacity");
  return result.data;
}
