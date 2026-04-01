import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/ai-day-planner';
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = global._prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global._prisma = prisma;
}

export default prisma;
