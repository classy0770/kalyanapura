import { WeddingPreviewFrame } from "@/modules/weddings/components/wedding-preview-frame";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WeddingPreviewFrame>{children}</WeddingPreviewFrame>;
}
