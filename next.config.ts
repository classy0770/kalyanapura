import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Verification/reset requests contain bearer links; never print them.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//, /\/reset-password/, /\/login\?/, /\/invite\//, /\/api\/v1\/guest\/access/] } },
  async headers() {
    return [{ source: "/invite/:path*",headers: [{ key: "Referrer-Policy",value: "no-referrer" },{ key: "Cache-Control",value: "private, no-store" },{ key: "X-Robots-Tag",value: "noindex, nofollow" }] },{ source: "/invitation",headers: [{ key: "Referrer-Policy",value: "no-referrer" },{ key: "Cache-Control",value: "private, no-store" },{ key: "X-Robots-Tag",value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
