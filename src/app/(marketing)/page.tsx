import type { Metadata } from "next";
import { Homepage } from "@/modules/marketing/components/homepage";

export const metadata: Metadata = {
  title: { absolute: "KalyanaPura — Your wedding, beautifully organised." },
  description: "A shared space for Indian couples and their families to plan celebrations, coordinate guests, and collect wedding memories. Explore the homepage preview.",
};

export default function HomePage() {
  return <Homepage />;
}
