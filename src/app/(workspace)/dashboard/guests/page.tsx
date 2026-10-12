import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedAccount } from "@/modules/accounts/server/session";
import { getWeddingService } from "@/modules/weddings/server/service";
import { DashboardPreview } from "@/modules/weddings/components/dashboard-preview";
import { GuestsManager } from "@/modules/guests/components/guests-manager";
import { getGuestService } from "@/modules/guests/server/service";
import { getGuestPartyLimit } from "@/modules/guests/server/config";
import { getEventService } from "@/modules/events/server/service";
import { daysUntilWedding } from "@/modules/weddings/schemas";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";

export const runtime = "nodejs";
export const metadata = { title: "Guest list" };
export default async function GuestsPage() {
  let account, context, list, count, events, limit;
  try {
    account = await requireVerifiedAccount(await headers());
    context = await (await getWeddingService()).context(account);
    if (context.wedding) {
      const service = await getGuestService();
      list = await service.list(account,context.wedding.id); count = await service.count(account,context.wedding.id);
      const eventService = await getEventService();
      const firstEvents = await eventService.list(account,context.wedding.id,new URLSearchParams({ limit: "100" }));
      events = firstEvents.data;
      let next = firstEvents.page.nextCursor;
      while (next) { const more = await eventService.list(account,context.wedding.id,new URLSearchParams({ limit: "100",cursor: next })); events.push(...more.data); next = more.page.nextCursor; }
      limit = getGuestPartyLimit();
    }
  } catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <section><h1>Workspace temporarily unavailable.</h1><p>Please try again when wedding services are available.</p></section>;
  }
  if (context.nextAction === "create_or_join") redirect("/create-wedding");
  if (!context.wedding || !context.membership || !list || count === undefined || !events || !limit) return <section><h1>Membership cleanup in progress.</h1><p>Please wait for your previous membership cleanup to finish.</p></section>;
  return <DashboardPreview accountName={account.name} details={{ ...context.wedding, title: context.wedding.title ?? "" }} membership={context.membership} initialDays={daysUntilWedding(context.wedding.weddingDate)} activePage="guests"><GuestsManager weddingId={context.wedding.id} initialGuests={list.data} initialPage={list.page} guestCount={count} eventChoices={events} partyLimit={limit} /></DashboardPreview>;
}
