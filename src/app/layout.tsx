import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KalyanaPura · Project foundation", template: "%s · KalyanaPura" },
  description: "The foundation for a shared Indian wedding workspace. Product workflows are not implemented yet.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
