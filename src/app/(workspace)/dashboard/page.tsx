import { getEventService } from "@/modules/events/server/service";
import { getGuestService } from "@/modules/guests/server/service";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireVerifiedAccount } from "@/modules/accounts/server/session";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
import { DashboardPreview } from "@/modules/weddings/components/dashboard-preview";
import { getWeddingService } from "@/modules/weddings/server/service";
import { daysUntilWedding } from "@/modules/weddings/schemas";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Wedding dashboard" };
export const runtime = "nodejs";

export default async function DashboardPage() {
  let account, context, eventOverview, rsvpOverview;
  try {
    account = await requireVerifiedAccount(await headers());
    context = await (await getWeddingService()).context(account);
    if (context.wedding) eventOverview = await (await getEventService()).overview(account, context.wedding.id);
    if (context.wedding) rsvpOverview = await (await getGuestService()).overview(account,context.wedding.id);
  } catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <section><h1>Dashboard temporarily unavailable.</h1><p>We couldn’t check your session. Please try again once account services are available.</p></section>;
  }
  if (context.nextAction === "create_or_join") redirect("/create-wedding");
  if (!context.wedding || !context.membership) return <section><h1>Membership cleanup in progress.</h1><p>Your previous wedding membership is being removed. Please try again once cleanup finishes.</p></section>;
  return <DashboardPreview accountName={account.name} details={{ ...context.wedding, title: context.wedding.title ?? "" }} membership={context.membership} eventOverview={eventOverview} guestCount={rsvpOverview?.guestCount} rsvpOverview={rsvpOverview} initialDays={daysUntilWedding(context.wedding.weddingDate)} />;
}
