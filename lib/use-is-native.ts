'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the app is running inside the Capacitor native shell
 * (iOS / Android), false in a normal browser / PWA. Resolves after mount, so
 * it always starts as `false` on the server and first client render to keep
 * hydration stable.
 */
export function useIsNative(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let active = true;
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (active) setIsNative(Capacitor.isNativePlatform());
      })
      .catch(() => {
        /* not in a Capacitor context — stay false */
      });
    return () => {
      active = false;
    };
  }, []);

  return isNative;
}
