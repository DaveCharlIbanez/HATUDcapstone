import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export so the app can be wrapped in a native shell (Capacitor).
  // See MOBILE_PACKAGING_PLAN.md. Build output lands in `out/`.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
