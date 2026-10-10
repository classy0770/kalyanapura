import "server-only";

import { randomUUID } from "node:crypto";

import type { AcceptedOperation, ApiList, ApiPage, ApiSuccess } from "@/shared/http/api-contract";

export function createRequestId(): string {
  // Server generated: do not echo arbitrary incoming header contents.
  return `req_${randomUUID()}`;
}

export function productHeaders(requestId: string): Headers {
  return new Headers({
    "X-Request-Id": requestId,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
}

type ResourceOptions =
  | { status?: 200; location?: string; version?: number }
  | { status: 201; location: string; version?: number };

export function resourceResponse<T>(data: T, requestId: string, options: ResourceOptions = {}): Response {
  const headers = productHeaders(requestId);
  if (options.location) headers.set("Location", options.location);
  if (options.version !== undefined) headers.set("X-Resource-Version", String(options.version));
  const body: ApiSuccess<T> = { data, meta: { requestId } };
  return Response.json(body, { status: options.status ?? 200, headers });
}

export function listResponse<T>(data: T[], page: ApiPage, requestId: string): Response {
  const body: ApiList<T> = { data, page, meta: { requestId } };
  return Response.json(body, { headers: productHeaders(requestId) });
}

export function acceptedResponse(operation: AcceptedOperation, requestId: string): Response {
  const headers = productHeaders(requestId);
  headers.set("Location", operation.statusUrl);
  headers.set("Retry-After", "2");
  const body: ApiSuccess<AcceptedOperation> = { data: operation, meta: { requestId } };
  return Response.json(body, { status: 202, headers });
}

export function noContentResponse(requestId: string): Response {
  return new Response(null, { status: 204, headers: productHeaders(requestId) });
}

// Product JSON only: auth, media and provider handlers retain their own contracts.
