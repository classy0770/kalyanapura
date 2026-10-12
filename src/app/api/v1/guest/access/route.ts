import { handleGuestAccess } from "@/modules/guests/server/invitation-handlers";
export const runtime = "nodejs";
export const POST = handleGuestAccess;
export const DELETE = handleGuestAccess;
