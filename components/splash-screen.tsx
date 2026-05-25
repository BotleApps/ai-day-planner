'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export function SplashScreen() {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'done'>('in');

  useEffect(() => {
    // Only show once per browser session
    if (sessionStorage.getItem('sp:splashed')) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem('sp:splashed', '1');

    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 1600);
    const t3 = setTimeout(() => setPhase('done'), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div className={`splash ${phase}`} aria-hidden="true">
      <div className="splash-content">
        <div className="splash-icon">
          <Sparkles size={32} />
        </div>
        <div className="splash-wordmark">
          Sorted<strong>Plan</strong>
        </div>
        <div className="splash-tagline">Plan smarter. Travel better.</div>
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
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: all;
        }
        .splash.in    { opacity: 0; }
        .splash.hold  { opacity: 1; }
        .splash.out   { opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }

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
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 40%, transparent);
          animation: splash-pulse 1.2s ease-in-out infinite;
        }
        @keyframes splash-pulse {
          0%, 100% { box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 40%, transparent); }
          50%       { box-shadow: 0 12px 48px color-mix(in srgb, var(--primary) 60%, transparent); }
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
