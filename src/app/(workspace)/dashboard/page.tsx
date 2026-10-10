import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireVerifiedAccount } from "@/modules/accounts/server/session";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
import { DashboardPreview } from "@/modules/weddings/components/dashboard-preview";

export const metadata: Metadata = { title: "Dashboard preview" };
export const runtime = "nodejs";

export default async function DashboardPage() {
  try {
    await requireVerifiedAccount(await headers());
  } catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <section><h1>Dashboard temporarily unavailable.</h1><p>We couldn’t check your session. Please try again once account services are available.</p></section>;
  }
  return <DashboardPreview />;
}
