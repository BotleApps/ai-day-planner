import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Standalone output: a self-contained Node.js server is emitted at
  // .next/standalone/server.js — required by Render's startCommand (see render.yaml).
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
  ],
  // Turbopack configuration
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Prevent Turbopack from hashing/aliasing these packages
      '@prisma/client': '@prisma/client',
      '@prisma/adapter-pg': '@prisma/adapter-pg',
      'pdf-parse': 'pdf-parse',
      'officeparser': 'officeparser',
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
