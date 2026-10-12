import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedAccount } from "@/modules/accounts/server/session";
import { getWeddingService } from "@/modules/weddings/server/service";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
import { CreateWeddingPreview } from "@/modules/weddings/components/create-wedding-preview";
import { WeddingPreviewFrame } from "@/modules/weddings/components/wedding-preview-frame";
export const metadata = { title: "Create your wedding" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function CreateWeddingPage() {
  let context;
  try {
    const account = await requireVerifiedAccount(await headers());
    context = await (await getWeddingService()).context(account);
  } catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <WeddingPreviewFrame><section><h1>Wedding setup temporarily unavailable.</h1><p>We couldn’t check your account. Please try again once account services are available.</p></section></WeddingPreviewFrame>;
  }
  if (context.nextAction === "dashboard") redirect("/dashboard");
  if (context.nextAction === "membership_cleanup") return <WeddingPreviewFrame><section><h1>Membership cleanup in progress.</h1><p>Please wait for your previous wedding membership cleanup to finish before creating another wedding.</p></section></WeddingPreviewFrame>;
  return <WeddingPreviewFrame><CreateWeddingPreview mode="create" /></WeddingPreviewFrame>;
}
