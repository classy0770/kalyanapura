import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Verification/reset requests contain bearer links; never print them.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//, /\/reset-password/, /\/login\?/] } },
};

export default nextConfig;
