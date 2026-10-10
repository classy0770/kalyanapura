import { serve } from "inngest/next";
import type { NextRequest } from "next/server";
import { accountEmail, inngest, reconcileAccountEmails } from "@/server/jobs/inngest";
import { errorResponse } from "@/server/http/errors";
import { createRequestId } from "@/server/http/responses";
import { CapabilityConfigurationError } from "@/server/config";

export const runtime = "nodejs";
const handlers = serve({ client: inngest, functions: [accountEmail, reconcileAccountEmails] });
async function handle(request: NextRequest, method: "GET" | "POST" | "PUT") {
  if (process.env.NODE_ENV === "production" && (!process.env.INNGEST_SIGNING_KEY || ["1", "true"].includes(process.env.INNGEST_DEV ?? ""))) {
    return errorResponse(new CapabilityConfigurationError("Email worker signing"), createRequestId());
  }
  return handlers[method](request, {});
}
export const GET = (request: NextRequest) => handle(request, "GET");
export const POST = (request: NextRequest) => handle(request, "POST");
export const PUT = (request: NextRequest) => handle(request, "PUT");
