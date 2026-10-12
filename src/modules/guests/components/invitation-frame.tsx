import localFont from "next/font/local";
const display = localFont({ src: [
  { path: "../../../../public/fonts/cormorant-400.ttf",weight: "400",style: "normal" },
  { path: "../../../../public/fonts/cormorant-italic-400.ttf",weight: "400",style: "italic" },
],variable: "--wedding-display",display: "swap" });
const body = localFont({ src: [
  { path: "../../../../public/fonts/jakarta-400.ttf",weight: "400",style: "normal" },
  { path: "../../../../public/fonts/jakarta-600.ttf",weight: "600",style: "normal" },
],variable: "--wedding-body",display: "swap" });
export function InvitationFrame({ children }: { children: React.ReactNode }) { return <div className={`${display.variable} ${body.variable}`}>{children}</div>; }
