'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReturnedOnline, setShowReturnedOnline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => {
      setIsOffline(true);
      setShowReturnedOnline(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReturnedOnline(true);
      setTimeout(() => setShowReturnedOnline(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showReturnedOnline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 16px',
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        background: isOffline ? '#1f2937' : '#059669',
        color: 'white',
        transition: 'background 0.3s',
        pointerEvents: 'none',
      }}
    >
      <WifiOff size={14} />
      {isOffline ? 'Offline — showing cached data' : 'Back online'}
    </div>
  );
}
