import { GuestListPreview } from "@/modules/guests/components/guest-list-preview";
import { DashboardPreview } from "@/modules/weddings/components/dashboard-preview";
import { WeddingPreviewFrame } from "@/modules/weddings/components/wedding-preview-frame";

export const metadata = { title: "Guest list design preview", robots: { index: false, follow: false } };
export default function GuestDesignPage() {
  return <WeddingPreviewFrame><DashboardPreview activePage="guests"><GuestListPreview /></DashboardPreview></WeddingPreviewFrame>;
}
