'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72; // px of pull needed to trigger refresh
const MAX_PULL = 108; // px cap on visual travel

export function PullToRefresh() {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullYRef = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Only start pull gesture when already scrolled to the very top
      if (window.scrollY > 4) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        isPullingRef.current = false;
        pullYRef.current = 0;
        setPullY(0);
        return;
      }
      // Rubber-band: pull slows down as distance increases
      const clamped = Math.min(delta * 0.45, MAX_PULL);
      pullYRef.current = clamped;
      setPullY(clamped);
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullYRef.current >= THRESHOLD) {
        setIsRefreshing(true);
        setTimeout(() => window.location.reload(), 600);
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  if (pullY === 0 && !isRefreshing) return null;

  const progress = Math.min(pullY / THRESHOLD, 1);
  const translateY = Math.min(pullY, THRESHOLD) - 48;
  const spinning = isRefreshing || pullY >= THRESHOLD;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: `translate(-50%, ${translateY}px)`,
          zIndex: 1100,
          width: 44,
          height: 44,
          background: 'var(--card, white)',
          borderRadius: '50%',
          boxShadow: '0 3px 16px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary, #6366f1)',
          transition: spinning ? 'none' : 'transform 0.08s linear',
          pointerEvents: 'none',
        }}
      >
        <RefreshCw
          size={20}
          style={{
            transform: spinning ? undefined : `rotate(${progress * 270}deg)`,
            opacity: 0.5 + progress * 0.5,
            animation: spinning ? 'ptr-spin 0.75s linear infinite' : undefined,
          }}
        />
      </div>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
