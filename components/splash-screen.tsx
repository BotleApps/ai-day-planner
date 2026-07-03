'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function SplashScreen() {
  const [phase, setPhase] = useState<'hold' | 'out' | 'done'>('hold');

  useEffect(() => {
    // Only show once per browser session
    if (sessionStorage.getItem('sp:splashed')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating phase from sessionStorage (client-only) requires effect
      setPhase('done');
      return;
    }
    sessionStorage.setItem('sp:splashed', '1');

    const t1 = setTimeout(() => setPhase('out'), 1600);
    const t2 = setTimeout(() => setPhase('done'), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div className={`splash splash-${phase}`} aria-hidden="true">
      <div className="splash-content">
        <div className="splash-icon">
          <Image src="/icons/icon-sorted-plan.svg" alt="SortedPlan" width={52} height={52} />
        </div>
        <div className="splash-wordmark">
          Sorted<strong>Plan</strong>
        </div>
        <div className="splash-tagline">Plan smarter. Achieve more.</div>
      </div>

      <style jsx>{`
        .splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          pointer-events: all;
        }
        .splash-out { opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }

        .splash-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          transform: translateY(0);
          animation: splash-rise 0.5s ease forwards;
        }
        @keyframes splash-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .splash-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          overflow: hidden;
          animation: splash-pulse 1.2s ease-in-out infinite;
        }
        .splash-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        @keyframes splash-pulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
          50%       { box-shadow: 0 12px 48px rgba(0,0,0,0.25); }
        }

        .splash-wordmark {
          font-size: 28px;
          font-weight: 500;
          color: var(--foreground);
          letter-spacing: -0.02em;
        }
        .splash-wordmark strong { font-weight: 800; }

        .splash-tagline {
          font-size: 14px;
          color: var(--muted-foreground);
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}
