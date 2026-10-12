import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KalyanaPura · Project foundation", template: "%s · KalyanaPura" },
  description: "A shared Indian wedding workspace for couples and their families.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
