import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the SortedPlan native shell (iOS + Android).
 *
 * This app relies on Next.js API routes, Prisma/Postgres and Google OAuth, so a
 * static export is NOT viable. Instead the native shell loads the *deployed*
 * web app over HTTPS (the "remote server" pattern). Point it at the right
 * landscape with the CAP_SERVER_URL env var before running `npx cap sync`:
 *
 *   CAP_SERVER_URL="https://<your-dev-app>.cfapps.eu12.hana.ondemand.com" npx cap sync
 *
 * If CAP_SERVER_URL is unset, the shell falls back to the bundled
 * `mobile/www/index.html` page (a friendly "configure the server URL" notice).
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.sortedplan.app',
  appName: 'SortedPlan',
  webDir: 'mobile/www',
  backgroundColor: '#0f0f23',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          // Only allow plain HTTP for explicit localhost dev URLs.
          cleartext: /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/.test(serverUrl),
        },
      }
    : {}),
  ios: {
    backgroundColor: '#0f0f23',
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#0f0f23',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      launchAutoHide: true,
      backgroundColor: '#6366f1',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
