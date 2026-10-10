import { handleAuth } from "@/modules/accounts/server/handler";
export const runtime = "nodejs";
export const GET = handleAuth;
export const POST = handleAuth;
