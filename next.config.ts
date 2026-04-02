import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Standalone output required for SAP BTP Cloud Foundry deployment
  output: 'standalone',
  // Tell Next.js/Turbopack NOT to bundle these Node.js packages — load them
  // natively at runtime so their internal require() paths aren't mangled.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'prisma',
    '.prisma',
    '.prisma/client',
    'pg',
    'pg-pool',
    'pg-protocol',
    'pg-types',
    'pgpass',
    'pdf-parse',
    'officeparser',
    'pdfjs-dist',
  ],
  // Turbopack configuration
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Prevent Turbopack from hashing/aliasing Prisma packages
      '@prisma/client': '@prisma/client',
      '@prisma/adapter-pg': '@prisma/adapter-pg',
    },
  },
  images: {
    // Disable built-in image optimisation so the Sharp native module is not
    // required at runtime — avoids rebuild failures on Cloud Foundry.
    unoptimized: true,
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
