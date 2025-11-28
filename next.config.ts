import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow very large file uploads (500MB - can be increased if needed)
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Hide error overlay and disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable error overlay in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
