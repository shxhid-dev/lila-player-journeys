import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile in a parent directory is never picked up.
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        // Generated telemetry only changes on deploy. Cache it, but revalidate daily.
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
