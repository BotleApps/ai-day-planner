'use client';

import { useEffect } from 'react';

/**
 * Press Escape to invoke `onEscape` while `active` is true.
 * No-op when inactive — safe to mount unconditionally.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}
