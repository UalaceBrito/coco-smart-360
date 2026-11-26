import type { NextConfig } from "next";

const apiBase = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:18765"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/local-https/coco-smart-360-root.mobileconfig",
        headers: [
          {
            key: "Content-Type",
            value: "application/x-apple-aspen-config",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${apiBase}/health`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
