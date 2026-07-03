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
      // Enforce coverage across the whole `lib/` (pure helpers, no runtime deps
      // beyond what the routes already carry) AND every state-changing App
      // Router route under `app/api/`. Excluded:
      //   - `lib/db.ts`         — Prisma singleton, needs a live DB harness.
      //   - `lib/gemini.ts` / `lib/sap-ai-core.ts` — network-only clients; the
      //     dispatcher in ai-dispatch.ts is covered.
      //   - `lib/native-google-auth.ts` — Capacitor bridge; requires a native
      //     shell to exercise meaningfully.
      //   - `lib/use-escape-key.ts` — React hook; needs jsdom + RTL (later).
      //   - `lib/types.ts`      — pure type + constant declarations, no branches.
      //   - `app/api/auth/`, `app/api/health/` — thin NextAuth handler and a
      //     static health probe; nothing to unit-test.
      //   - `app/api/ai/*` and `app/api/upload/` — delegate to the AI/upload
      //     integration; the pure libs they call (ai-dispatch, rate-limit)
      //     are covered.
      include: [
        'lib/ai-dispatch.ts',
        'lib/ai-settings.ts',
        'lib/checklist-access.ts',
        'lib/crypto.ts',
        'lib/rate-limit.ts',
        'lib/utils.ts',
        'lib/verify-google-token.ts',
        'app/api/plans/route.ts',
        'app/api/plans/share/route.ts',
        'app/api/tasks/route.ts',
        'app/api/activities/route.ts',
        'app/api/checklists/route.ts',
        'app/api/checklists/items/route.ts',
        'app/api/checklists/share/route.ts',
        'app/api/user-settings/route.ts',
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
