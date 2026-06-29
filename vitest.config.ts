import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Cover only the pure utility libs for now — extending coverage to
      // React components and API routes requires the full Next.js test
      // harness (jsdom + msw), which is the next-iteration task.
      include: [
        'lib/crypto.ts',
        'lib/utils.ts',
        'lib/rate-limit.ts',
        'lib/ai-settings.ts',
        'lib/checklist-access.ts',
        'lib/verify-google-token.ts',
        'lib/ai-dispatch.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
