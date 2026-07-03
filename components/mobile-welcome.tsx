'use client';

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import {
  Calendar,
  CheckSquare,
  Share2,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { nativeGoogleSignIn } from '@/lib/native-google-auth';

/**
 * MobileWelcome — the native (iOS / Android) pre-login experience.
 *
 * Flow:
 *   1. Splash (handled by the native + <SplashScreen /> overlay).
 *   2. Onboarding — interactive slides you step through, with Skip. Shown only
 *      when the `sp:onboarded` local flag is NOT set.
 *   3. Login — brand + "Continue with Google" (native Google Sign-In).
 *
 * Once onboarding is completed or skipped we persist the flag, so returning
 * users go straight from splash → login. (The same flag suppresses the
 * post-login OnboardingModal on native.)
 */

const SLIDES = [
  {
    icon: <Sparkles size={36} />,
    tint: '#6366f1',
    bg: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
    title: 'Welcome to SortedPlan',
    body: 'Your AI travel companion. Plan smarter, travel better — from a city day trip to a three-week adventure.',
  },
  {
    icon: <Calendar size={36} />,
    tint: '#10b981',
    bg: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    title: 'Beautiful itineraries',
    body: 'Paste any itinerary or describe your trip — AI builds a time-blocked plan in seconds. Drag and drop to fine-tune.',
  },
  {
    icon: <CheckSquare size={36} />,
    tint: '#f59e0b',
    bg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    title: 'Smart checklists',
    body: 'Never forget a thing. AI generates packing lists, to-dos and booking checklists tailored to your trip.',
  },
  {
    icon: <Share2 size={36} />,
    tint: '#3b82f6',
    bg: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
    title: 'Share with your crew',
    body: 'One tap to share any plan or checklist. Friends can view without an account. Explore together.',
  },
];

const ONBOARDED_KEY = 'sp:onboarded';

type Phase = 'onboarding' | 'login';

export function MobileWelcome() {
  // null until we've read the local flag, so we don't flash onboarding at
  // returning users (the splash overlay covers this first frame anyway).
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    let onboarded = false;
    try {
      onboarded = !!localStorage.getItem(ONBOARDED_KEY);
    } catch {
      /* ignore */
    }
    setPhase(onboarded ? 'login' : 'onboarding'); // eslint-disable-line react-hooks/set-state-in-effect -- hydrating phase from localStorage on mount
  }, []);

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* ignore */
    }
    setPhase('login');
  };

  if (phase === null) return null;

  return phase === 'onboarding' ? (
    <Onboarding onDone={completeOnboarding} />
  ) : (
    <Login />
  );
}

/* ─────────────────────────── Onboarding ─────────────────────────── */

function Onboarding({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  const goTo = (i: number) =>
    setSlide(Math.max(0, Math.min(SLIDES.length - 1, i)));
  const next = () => (isLast ? onDone() : goTo(slide + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && isLast) onDone();
      else goTo(slide + (dx < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  };

  return (
    <div className="mw">
      <div className="mw-glow" style={{ background: current.tint }} />

      {/* Skip */}
      <div className="mw-top">
        <button className="mw-skip" onClick={onDone}>
          Skip
        </button>
      </div>

      {/* Slide */}
      <div className="mw-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="mw-illus" style={{ background: current.bg }} key={slide}>
          <div className="mw-illus-icon">{current.icon}</div>
          <div className="mw-ring mw-ring-1" />
          <div className="mw-ring mw-ring-2" />
        </div>
        <div className="mw-copy" key={`copy-${slide}`}>
          <h1>{current.title}</h1>
          <p>{current.body}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="mw-controls">
        <div className="mw-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`mw-dot ${i === slide ? 'is-active' : ''}`}
              style={i === slide ? { background: current.tint } : undefined}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          className="mw-next"
          onClick={next}
          style={{ background: current.tint }}
        >
          {isLast ? 'Get Started' : 'Next'}
          <ArrowRight size={18} />
        </button>
      </div>

      <WelcomeStyles />
    </div>
  );
}

/* ───────────────────────────── Login ─────────────────────────────── */

function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const idToken = await nativeGoogleSignIn();
      await signIn('google-native', { idToken, callbackUrl: '/' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="mw mw-login">
      <div className="mw-glow" style={{ background: 'var(--primary)' }} />

      <div className="mw-hero">
        <div className="mw-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-sorted-plan.svg" alt="SortedPlan" width={56} height={56} />
        </div>
        <h1 className="mw-wordmark">
          Sorted<strong>Plan</strong>
        </h1>
        <p className="mw-tagline">Plan smarter. Achieve more.</p>
      </div>

      <div className="mw-auth">
        <button className="mw-google" onClick={handleSignIn} disabled={loading}>
          {loading ? (
            <Loader2 size={20} className="mw-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
        {error && <p className="mw-error">{error}</p>}
        <p className="mw-legal">By continuing you agree to our Terms &amp; Privacy Policy.</p>
      </div>

      <WelcomeStyles />
    </div>
  );
}

/* ───────────────────────────── Styles ────────────────────────────── */

function WelcomeStyles() {
  return (
    <style jsx global>{`
      .mw {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        flex-direction: column;
        background: var(--background);
        color: var(--foreground);
        padding: calc(env(safe-area-inset-top, 0px) + 16px) 24px
          calc(env(safe-area-inset-bottom, 0px) + 24px);
        overflow: hidden;
        animation: mw-screen-in 0.35s ease;
      }
      @keyframes mw-screen-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      .mw-glow {
        position: absolute;
        top: -120px;
        left: 50%;
        width: 320px;
        height: 320px;
        transform: translateX(-50%);
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.28;
        transition: background 0.6s ease;
        pointer-events: none;
      }

      /* Top bar (Skip) */
      .mw-top {
        display: flex;
        justify-content: flex-end;
        position: relative;
        z-index: 1;
        min-height: 32px;
      }
      .mw-skip {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 15px;
        font-weight: 600;
        padding: 6px 8px;
        cursor: pointer;
      }

      /* Slide stage */
      .mw-stage {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
        position: relative;
        z-index: 1;
      }
      .mw-illus {
        width: 176px;
        height: 176px;
        border-radius: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22);
        animation: mw-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .mw-illus-icon {
        color: #fff;
        z-index: 1;
        filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.25));
      }
      .mw-ring {
        position: absolute;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
      }
      .mw-ring-1 {
        width: 124px;
        height: 124px;
      }
      .mw-ring-2 {
        width: 200px;
        height: 200px;
        border-color: rgba(255, 255, 255, 0.14);
      }
      @keyframes mw-pop {
        from {
          opacity: 0;
          transform: scale(0.85);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .mw-copy {
        text-align: center;
        max-width: 360px;
        animation: mw-fade 0.4s ease;
      }
      .mw-copy h1 {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0 0 10px;
      }
      .mw-copy p {
        font-size: 15px;
        line-height: 1.55;
        color: var(--muted-foreground);
        margin: 0;
      }
      @keyframes mw-fade {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Controls */
      .mw-controls {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 22px;
      }
      .mw-dots {
        display: flex;
        gap: 8px;
      }
      .mw-dot {
        width: 7px;
        height: 7px;
        border-radius: 99px;
        border: none;
        padding: 0;
        background: var(--border);
        cursor: pointer;
        transition: width 0.25s ease, background 0.25s ease;
      }
      .mw-dot.is-active {
        width: 22px;
      }
      .mw-next {
        width: 100%;
        max-width: 420px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 16px;
        border: none;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
        transition: transform 0.12s ease, filter 0.6s ease;
      }
      .mw-next:active {
        transform: scale(0.98);
      }

      /* Login hero */
      .mw-login {
        justify-content: space-between;
      }
      .mw-hero {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        position: relative;
        z-index: 1;
      }
      .mw-logo {
        width: 84px;
        height: 84px;
        border-radius: 22px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 14px 38px rgba(99, 102, 241, 0.28);
        animation: mw-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .mw-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .mw-wordmark {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 6px 0 0;
      }
      .mw-wordmark strong {
        color: var(--primary);
        font-weight: 800;
      }
      .mw-tagline {
        font-size: 15px;
        color: var(--muted-foreground);
        margin: 0;
      }

      /* Auth */
      .mw-auth {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .mw-google {
        width: 100%;
        max-width: 420px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      .mw-google:active {
        transform: scale(0.98);
      }
      .mw-google:disabled {
        opacity: 0.7;
        cursor: default;
      }
      .mw-error {
        font-size: 13px;
        color: #ef4444;
        text-align: center;
        margin: 0;
        line-height: 1.4;
      }
      .mw-legal {
        font-size: 11.5px;
        color: var(--muted-foreground);
        text-align: center;
        margin: 0;
        opacity: 0.8;
      }
      .mw-spin {
        animation: mw-rotate 0.8s linear infinite;
      }
      @keyframes mw-rotate {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  );
}
