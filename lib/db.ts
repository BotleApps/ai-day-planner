import { PrismaClient } from '@prisma/client';

declare global {
   
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://postgres:password@localhost:5432/sortedplan';

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg');
  // Default to strict cert verification. Set DB_SSL_REJECT_UNAUTHORIZED=false
  // only for local dev with a self-signed cert.
  const sslConfig = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: true };
  const adapter = new PrismaPg({ connectionString, ssl: sslConfig });
  return new PrismaClient({ adapter });
}

const prisma = global._prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global._prisma = prisma;
}

export default prisma;
