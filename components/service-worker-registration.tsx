'use client';

import { useEffect } from 'react';

/**
 * The app no longer ships a PWA service worker (we deliver native iOS / Android
 * shells via Capacitor instead). This component cleans up after any service
 * worker that an earlier PWA build registered on a returning visitor's device,
 * so stale cached assets don't get served. It registers nothing.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      })
      .catch(() => {
        /* no-op */
      });

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {
          /* no-op */
        });
    }
  }, []);

  return null;
}
