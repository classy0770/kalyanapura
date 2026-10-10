import { CreateWeddingPreview } from "@/modules/weddings/components/create-wedding-preview";
import { WeddingPreviewFrame } from "@/modules/weddings/components/wedding-preview-frame";
export const metadata = { title: "Wedding creation design preview" };
export default function CreateWeddingPage() { return <WeddingPreviewFrame><CreateWeddingPreview /></WeddingPreviewFrame>; }
