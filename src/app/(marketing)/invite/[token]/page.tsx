import { InvitationEntry } from "@/modules/guests/components/invitation-entry";
import { InvitationFrame } from "@/modules/guests/components/invitation-frame";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Personal invitation",robots: { index: false,follow: false },referrer: "no-referrer" as const };
export default async function InvitationEntryPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <InvitationFrame><InvitationEntry token={token} /></InvitationFrame>; }
