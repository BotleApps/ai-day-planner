import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Standalone output required for SAP BTP Cloud Foundry deployment
  output: 'standalone',
  // Turbopack configuration
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
