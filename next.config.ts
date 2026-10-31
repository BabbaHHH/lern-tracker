import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolated local QA can run alongside the user's usual development server.
  distDir: process.env.STEX_ISOLATED_DEV === "1" ? ".next-qa" : ".next",
  env: {
    // Only the separate development test server can freeze the planning day.
    STEX_REFERENCE_DATE: process.env.NODE_ENV === "development" && process.env.STEX_ISOLATED_DEV === "1"
      ? process.env.STEX_TEST_DATE || "" : "",
  },
  poweredByHeader: false,
  // Invitation and verification URLs contain temporary bearer proofs.
  logging: { incomingRequests: { ignore: [/\/api\/auth(?:\/|\?|$)/, /\/konto(?:\/|\?|$)/] } },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] }, { source: "/konto/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
    { source: "/api/auth/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;
