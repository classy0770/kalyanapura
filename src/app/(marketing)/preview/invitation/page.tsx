import { InvitationPreview } from "@/modules/guests/components/invitation-preview";
import { InvitationFrame } from "@/modules/guests/components/invitation-frame";

export const metadata = { title: "Invitation & RSVP design preview", robots: { index: false, follow: false } };

export default function InvitationDesignPage() {
  return <InvitationFrame><InvitationPreview /></InvitationFrame>;
}
