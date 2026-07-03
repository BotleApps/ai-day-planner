'use client';

import { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Share2, Sparkles, ArrowRight, X } from 'lucide-react';

const SLIDES = [
  {
    icon: <Sparkles size={36} />,
    color: '#6366f1',
    bg: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
    title: 'Welcome to SortedPlan',
    body: 'Your AI-powered travel companion. Plan smarter, travel better — from a city day trip to a three-week adventure.',
  },
  {
    icon: <Calendar size={36} />,
    color: '#10b981',
    bg: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    title: 'Build Beautiful Itineraries',
    body: 'Paste any itinerary text or describe your trip — AI turns it into a perfectly time-blocked day plan in seconds. Drag and drop to adjust.',
  },
  {
    icon: <CheckSquare size={36} />,
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    title: 'Smart Checklists',
    body: 'Never forget a thing. AI generates comprehensive packing lists, to-dos, and booking checklists tailored to your specific trip.',
  },
  {
    icon: <Share2 size={36} />,
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
    title: 'Share with Your Crew',
    body: 'One tap to share any plan or checklist. Friends can view without an account. Collaborate and explore together.',
  },
];

const STORAGE_KEY = 'sp:onboarded';

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so splash can clear first
      const t = setTimeout(() => setVisible(true), 2400);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 380);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <div className={`overlay ${exiting ? 'exit' : 'enter'}`}>
      <div className={`modal ${exiting ? 'modal-exit' : 'modal-enter'}`}>

        {/* Close */}
        <button className="close-btn" onClick={dismiss} aria-label="Skip onboarding">
          <X size={18} />
        </button>

        {/* Illustration */}
        <div className="illustration" style={{ background: current.bg }}>
          <div className="illustration-icon">{current.icon}</div>
          <div className="illustration-ring ring-1" />
          <div className="illustration-ring ring-2" />
        </div>

        {/* Text */}
        <div className="text-block">
          <h2>{current.title}</h2>
          <p>{current.body}</p>
        </div>

        {/* Dots */}
        <div className="dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === slide ? 'dot-active' : ''}`}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="actions">
          {!isLast && (
            <button className="skip-btn" onClick={dismiss}>
              Skip
            </button>
          )}
          <button className="next-btn" onClick={next} style={{ background: current.color }}>
            {isLast ? 'Get Started' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .overlay.enter { animation: fade-in 0.3s ease forwards; }
        .overlay.exit  { animation: fade-out 0.35s ease forwards; }
        @keyframes fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }

        .modal {
          background: var(--card);
          width: 100%;
          max-width: 480px;
          border-radius: 28px 28px 0 0;
          /* Bound to dvh so long copy on short screens can scroll internally.
             The .actions footer uses position:sticky so Next/Skip stay
             pinned to the visible bottom regardless of content height.
             Safe-area-top keeps the sheet clear of the notch. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px));
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          position: relative;
        }
        .modal-enter { animation: slide-up 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .modal-exit  { animation: slide-down 0.35s ease forwards; }
        @keyframes slide-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slide-down { from { transform: translateY(0); }   to { transform: translateY(100%); } }

        /* On larger screens — centered card */
        @media (min-width: 500px) {
          .overlay { align-items: center; padding: 24px; }
          .modal {
            border-radius: 24px;
            max-width: 400px;
          }
          .modal-enter { animation: scale-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .modal-exit  { animation: scale-out 0.3s ease forwards; }
          @keyframes scale-in  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
          @keyframes scale-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); } }
        }

        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          background: rgba(0,0,0,0.15);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: background 0.15s;
        }
        .close-btn:hover { background: rgba(0,0,0,0.28); }

        /* Illustration */
        .illustration {
          width: 100%;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .illustration-icon {
          color: white;
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.2));
        }
        .illustration-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.18);
          pointer-events: none;
        }
        .ring-1 {
          width: 140px; height: 140px;
          animation: ring-pulse 2s ease-in-out infinite;
        }
        .ring-2 {
          width: 200px; height: 200px;
          animation: ring-pulse 2s ease-in-out infinite 0.5s;
        }
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.4; }
          50%       { transform: scale(1.08); opacity: 0.1; }
        }

        /* Text */
        .text-block {
          padding: 28px 28px 0;
          text-align: center;
        }
        .text-block h2 {
          font-size: 22px;
          font-weight: 800;
          color: var(--foreground);
          margin: 0 0 10px;
          letter-spacing: -0.02em;
        }
        .text-block p {
          font-size: 15px;
          color: var(--muted-foreground);
          line-height: 1.6;
          margin: 0;
        }

        /* Dots */
        .dots {
          display: flex;
          justify-content: center;
          gap: 7px;
          padding: 24px 0 0;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--border);
          border: none;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s;
        }
        .dot-active {
          width: 22px;
          border-radius: 4px;
          background: var(--primary);
        }

        /* Actions — sticky so Skip/Next stay pinned to the visible bottom
           when the modal scrolls; safe-area padding clears the iOS home
           indicator. */
        .actions {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px calc(24px + env(safe-area-inset-bottom, 0px));
          gap: 12px;
          background: var(--card);
          border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        }
        .skip-btn {
          padding: 10px 18px;
          background: transparent;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          color: var(--muted-foreground);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .skip-btn:hover { border-color: var(--foreground); color: var(--foreground); }
        .next-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 13px 24px;
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
        }
        .next-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .next-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
