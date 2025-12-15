import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
  },
  allowedDevOrigins: ['*'],
  turbopack: {},
};

export default nextConfig;
