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
  // Match the web app's light --background so any native chrome that briefly
  // shows during launch handoff blends into the page instead of appearing as
  // a black bar. The dark-mode user briefly sees light before React applies
  // .dark — acceptable trade-off; otherwise we'd need to mirror the system
  // colour scheme natively, which Capacitor doesn't support out of the box.
  backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
    // 'never' makes WKWebView extend edge-to-edge instead of being inset
    // inside the safe area. Components already pad for env(safe-area-inset-*)
    // (see .mw in mobile-welcome.tsx, plan-view, ai-panel, etc.), so the DOM
    // paints its own var(--background) into the safe-area strips — no more
    // black bars above the status bar or below the home indicator.
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#f8fafc',
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
      // Let the webview render under the status bar; the page's
      // env(safe-area-inset-top) padding reserves the right amount of space.
      overlaysWebView: true,
      style: 'DARK',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
