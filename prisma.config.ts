import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://I308056@localhost:5432/ai-day-planner',
  },
});
