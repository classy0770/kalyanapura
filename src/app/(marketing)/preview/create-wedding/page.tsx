import { CreateWeddingPreview } from "@/modules/weddings/components/create-wedding-preview";
import { WeddingPreviewFrame } from "@/modules/weddings/components/wedding-preview-frame";
export const metadata = { title: "Wedding setup design preview", robots: { index: false, follow: false } };
export default function WeddingDesignPreview() { return <WeddingPreviewFrame><CreateWeddingPreview /></WeddingPreviewFrame>; }
