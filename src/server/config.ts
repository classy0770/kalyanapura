import "server-only";

import { z } from "zod";

export class CapabilityConfigurationError extends Error {
  constructor(capability: string) {
    super(`${capability} configuration is missing or invalid.`);
    this.name = "CapabilityConfigurationError";
  }
}

export class CapabilityUnavailableError extends Error {
  constructor(capability: string) {
    super(`${capability} is temporarily unavailable.`);
    this.name = "CapabilityUnavailableError";
  }
}

const databaseSchema = z.object({
  uri: z.string().trim().regex(/^mongodb(?:\+srv)?:\/\/.+/),
  name: z.string().trim().min(1).max(63).regex(/^[a-zA-Z0-9_-]+$/),
});

const originSchema = z.url().refine((value) => {
  // Zod can run this refinement even after URL validation fails.
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    ["http:", "https:"].includes(url.protocol) &&
    url.pathname === "/" &&
    !url.search && !url.hash && !url.username && !url.password
  );
});

export function getDatabaseConfig() {
  const result = databaseSchema.safeParse({
    uri: process.env.MONGODB_URI,
    name: process.env.MONGODB_DB_NAME,
  });
  if (!result.success) throw new CapabilityConfigurationError("Database");
  return result.data;
}

export function getAppOrigin(): string {
  const result = originSchema.safeParse(process.env.APP_ORIGIN);
  if (!result.success) throw new CapabilityConfigurationError("Application origin");
  const url = new URL(result.data);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new CapabilityConfigurationError("Production HTTPS origin");
  }
  return url.origin;
}

// Validate capabilities when called, not during imports or shell rendering.
// Add auth/media/email/job configuration with those implementations.
