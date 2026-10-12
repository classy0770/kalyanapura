import { headers } from "next/headers";
import { getInvitationService } from "@/modules/guests/server/invitation-service";
import { ApiError } from "@/server/http/errors";
import { readGuestGrant } from "@/modules/guests/server/guest-access";
import type { GuestInvitation } from "@/modules/guests/invitation-contract";
import { InvitationFrame } from "@/modules/guests/components/invitation-frame";
import { InvitationUnavailable, PersonalInvitation } from "@/modules/guests/components/personal-invitation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your personal invitation",robots: { index: false,follow: false },referrer: "no-referrer" as const };
export default async function InvitationPage() {
  let view: GuestInvitation | null = null, temporary = false;
  try { const requestHeaders = await headers(); readGuestGrant(requestHeaders); view = await (await getInvitationService()).invitation(requestHeaders); }
  catch (error) { temporary = !(error instanceof ApiError && [401,404].includes(error.status)); }
  return <InvitationFrame>{view ? <PersonalInvitation view={view} /> : <InvitationUnavailable temporary={temporary} />}</InvitationFrame>;
}
