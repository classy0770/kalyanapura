import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedAccount } from "@/modules/accounts/server/session";
import { getWeddingService } from "@/modules/weddings/server/service";
import { DashboardPreview } from "@/modules/weddings/components/dashboard-preview";
import { getEventService } from "@/modules/events/server/service";
import { getEventLimit } from "@/modules/events/server/config";
import { EventsManager } from "@/modules/events/components/events-manager";
import { daysUntilWedding } from "@/modules/weddings/schemas";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
export const runtime = "nodejs";
export const metadata = { title: "Events & itineraries" };
export default async function EventsPage() {
  let account,context,list,capacity;
  try {
    account = await requireVerifiedAccount(await headers());
    context = await (await getWeddingService()).context(account);
    if (context.wedding) { list = await (await getEventService()).list(account,context.wedding.id); capacity = getEventLimit(); }
  } catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <section><h1>Events temporarily unavailable.</h1><p>Please try again when wedding services are available.</p></section>;
  }
  if (context.nextAction === "create_or_join") redirect("/create-wedding");
  if (!context.wedding || !context.membership || !list || !capacity) return <section><h1>Membership cleanup in progress.</h1><p>Please wait for your previous membership cleanup to finish.</p></section>;
  return <DashboardPreview accountName={account.name} details={{ ...context.wedding,title: context.wedding.title ?? "" }} membership={context.membership} initialDays={daysUntilWedding(context.wedding.weddingDate)} activePage="events"><EventsManager weddingId={context.wedding.id} initialEvents={list.data} initialPage={list.page} capacity={capacity} /></DashboardPreview>;
}
