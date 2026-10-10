import "server-only";
import { randomInt } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { after } from "next/server";
import { dispatchAccountEmails } from "@/server/jobs/inngest";
import { getAuth } from "./auth";
import { getAuthConfig, getMailConfig } from "./config";
import { emailSchema, loginSchema, signupSchema } from "../schemas";
import { ApiError, errorResponse } from "@/server/http/errors";
import { createRequestId } from "@/server/http/responses";

const postPaths = new Set(["sign-up/email", "sign-in/email", "sign-out", "send-verification-email", "request-password-reset", "reset-password"]);
const getPaths = new Set(["get-session", "verify-email"]);

export async function handleAuth(request: Request) {
  const requestId = createRequestId();
  const started = Date.now();
  const mailRequest = request.method === "POST" && /\/(sign-up\/email|send-verification-email|request-password-reset)$/.test(new URL(request.url).pathname);
  const minimumDuration = mailRequest ? 2000 + randomInt(250) : 0;
  try {
    const path = new URL(request.url).pathname.slice("/api/auth/".length);
    const resetCallback = /^reset-password\/[^/]+$/.test(path);
    if (!(request.method === "GET" ? getPaths.has(path) || resetCallback : postPaths.has(path))) return new Response(null, { status: 404 });
    const { origin } = getAuthConfig();
    const headers = new Headers(request.headers);
    // Shared conservative bucket unless deployment explicitly supplies a proxy-
    // overwritten IP header. Never trust arbitrary browser forwarded headers.
    const trustedHeader = process.env.AUTH_TRUSTED_IP_HEADER;
    headers.set("x-kalyanapura-client-ip", trustedHeader ? request.headers.get(trustedHeader) ?? "127.0.0.1" : "127.0.0.1");
    let body: string | undefined;
    if (request.method === "POST") {
      if (request.headers.get("origin") !== origin) throw new ApiError(403, "ORIGIN_REJECTED", "This request origin is not allowed.");
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request is too large."); }
        chunks.push(value);
      }
      let input: Record<string, unknown>;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw new ApiError(400, "INVALID_JSON", "Enter valid account details."); }
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "INVALID_JSON", "Enter valid account details.");
      if (path === "sign-up/email" || path === "sign-in/email") {
        const result = (path === "sign-up/email" ? signupSchema : loginSchema).safeParse(input);
        if (!result.success) throw new ApiError(422, "VALIDATION_FAILED", "Check your name, email, and password.");
        Object.assign(input, result.data);
      }
      if (path === "sign-up/email" || path === "send-verification-email") input.callbackURL ??= "/login?verified=1";
      if (path === "request-password-reset") input.redirectTo ??= "/reset-password";
      for (const field of ["callbackURL", "redirectTo"]) {
        if (input[field] !== undefined) {
          const allowed = field === "redirectTo" ? "/reset-password" : path === "sign-in/email" ? "/dashboard" : "/login?verified=1";
          if (input[field] !== allowed && input[field] !== `${origin}${allowed}`) throw new ApiError(400, "INVALID_CALLBACK", "This return address is not allowed.");
        }
      }
      if (["send-verification-email", "request-password-reset"].includes(path)) {
        const result = emailSchema.safeParse(input.email);
        if (!result.success) throw new ApiError(422, "VALIDATION_FAILED", "Enter a valid email address.");
        input.email = result.data;
      }
      if (["sign-up/email", "send-verification-email", "request-password-reset"].includes(path)) getMailConfig();
      body = JSON.stringify(input);
      headers.delete("content-length");
      headers.set("content-type", "application/json");
    } else if (path === "verify-email" || resetCallback) {
      const callback = new URL(request.url).searchParams.get("callbackURL");
      const allowed = resetCallback ? "/reset-password" : "/login?verified=1";
      if (callback !== allowed && callback !== `${origin}${allowed}`) throw new ApiError(400, "INVALID_CALLBACK", "This return address is not allowed.");
    }
    const response = await (await getAuth()).handler(new Request(request.url, { method: request.method, headers, body }));
    if (mailRequest && response.ok) after(() => dispatchAccountEmails().catch(() => undefined));
    if (response.status >= 500) throw new ApiError(503, "TEMPORARILY_UNAVAILABLE", "Account services are temporarily unavailable. Please try again.");
    const safeHeaders = new Headers(response.headers);
    safeHeaders.set("Cache-Control", "private, no-store");
    safeHeaders.set("X-Request-Id", requestId);
    safeHeaders.set("X-Content-Type-Options", "nosniff");
    safeHeaders.set("Referrer-Policy", "no-referrer");
    let responseBody = response.body;
    if (path === "sign-up/email" && response.ok) {
      const payload = await response.json();
      // Better Auth omits an unset image for stored users but returns null for
      // synthetic users. Keep both public signup response shapes identical.
      payload.user.image ??= null;
      responseBody = new Response(JSON.stringify(payload)).body;
      safeHeaders.delete("content-length");
    }
    // Keep provider publication out of the account-existence timing signal.
    if (minimumDuration) await setTimeout(Math.max(0, minimumDuration - (Date.now() - started)));
    return new Response(responseBody, { status: response.status, headers: safeHeaders });
  } catch (error) {
    if (minimumDuration) await setTimeout(Math.max(0, minimumDuration - (Date.now() - started)));
    const safe = errorResponse(error, requestId);
    const payload = await safe.json();
    // Keep the library-owned auth response shape, outside product JSON envelopes.
    return Response.json({ code: payload.error.code, message: payload.error.message }, { status: safe.status, headers: safe.headers });
  }
}
