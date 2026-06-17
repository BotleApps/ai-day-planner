'use client';

import { useEffect } from 'react';

/**
 * NativeBridge — wires up Capacitor native niceties when the app runs inside
 * the iOS / Android shell. On the web it is a no-op (the dynamic imports below
 * only execute after we confirm we're on a native platform), so it adds no
 * behaviour and no runtime cost to the browser/PWA build.
 *
 * Responsibilities on native:
 *  - Match the status-bar style to the current (light/dark) theme.
 *  - Hide the native splash screen once the web layer has mounted.
 *  - Handle the Android hardware back button (navigate back, or exit at root).
 *  - Catch OAuth deep-link returns (appUrlOpen) and route them in-app.
 */
export default function NativeBridge() {
  useEffect(() => {
    let cleanup = () => {};

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
          import('@capacitor/status-bar'),
          import('@capacitor/splash-screen'),
          import('@capacitor/app'),
        ]);

        // Keep the status bar below the web view so the existing layout (which
        // does not reserve top inset) renders correctly on both platforms.
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});

        const applyStatusBarStyle = () => {
          const isDark = document.documentElement.classList.contains('dark');
          StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
          // Android: tint the status-bar background to match the app chrome.
          if (Capacitor.getPlatform() === 'android') {
            StatusBar.setBackgroundColor({ color: isDark ? '#0f0f23' : '#f8fafc' }).catch(() => {});
          }
        };
        applyStatusBarStyle();

        // Re-apply when the theme class on <html> changes.
        const themeObserver = new MutationObserver(applyStatusBarStyle);
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class'],
        });

        // The web layer is ready — dismiss the native splash.
        SplashScreen.hide().catch(() => {});

        // Android hardware back button.
        const backHandle = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });

        // OAuth / deep-link returns (custom scheme or universal link).
        const urlHandle = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const parsed = new URL(url);
            const target = parsed.pathname + parsed.search + parsed.hash;
            if (target && target !== '/') {
              window.location.assign(target);
            }
          } catch {
            /* ignore malformed deep links */
          }
        });

        cleanup = () => {
          themeObserver.disconnect();
          backHandle.remove();
          urlHandle.remove();
        };
      } catch {
        // Capacitor not installed or running on the web — no-op.
      }
    })();

    return () => cleanup();
  }, []);

  return null;
}
