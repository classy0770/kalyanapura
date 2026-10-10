import "server-only";

import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
import { productHeaders } from "@/server/http/responses";
import type { ApiFailure, ApiValidationField } from "@/shared/http/api-contract";

type ErrorDetails = {
  fields?: ApiValidationField[];
  currentVersion?: number;
  retryAfterSeconds?: number;
  allow?: string[];
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly details: ErrorDetails = {},
  ) {
    super(publicMessage);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown, requestId: string): Response {
  const known = error instanceof ApiError
    ? error
    : error instanceof CapabilityConfigurationError
      ? new ApiError(503, "TEMPORARILY_UNAVAILABLE", "This capability is not configured.")
      : error instanceof CapabilityUnavailableError
        ? new ApiError(503, "TEMPORARILY_UNAVAILABLE", "This capability is temporarily unavailable.")
        : new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");

  const body: ApiFailure = {
    error: { code: known.code, message: known.publicMessage, requestId },
  };
  if (known.code === "VALIDATION_FAILED" && known.details.fields) {
    body.error.fields = known.details.fields;
  }
  if (known.details.currentVersion !== undefined) {
    body.error.currentVersion = known.details.currentVersion;
  }
  const headers = productHeaders(requestId);
  if (known.details.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(known.details.retryAfterSeconds));
  }
  if (known.details.allow) headers.set("Allow", known.details.allow.join(", "));
  // Unknown errors are intentionally never serialized or logged wholesale.
  return Response.json(body, { status: known.status, headers });
}
