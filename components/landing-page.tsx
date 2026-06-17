'use client';

import { signIn } from 'next-auth/react';
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Share2,
  MapPin,
  Zap,
  ArrowRight,
  Star,
} from 'lucide-react';

export function LandingPage() {
  const startSignIn = () => {
    const callbackUrl = typeof window !== 'undefined' ? window.location.href : '/';
    signIn('google', { callbackUrl });
  };

  return (
    <div className="landing">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="brand-icon">
              <img src="/icons/icon-sorted-plan.svg" alt="SortedPlan" width={28} height={28} />
            </div>
            <span className="brand-name">Sorted<strong>Plan</strong></span>
          </div>
          <button className="nav-signin" onClick={startSignIn}>
            Sign in
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />
        <div className="hero-inner">
          <div className="hero-badge">
            <Zap size={12} />
            AI-Powered Planning
          </div>
          <h1 className="hero-title">
            Plan smarter.<br />
            <span className="hero-gradient">Achieve more.</span>
          </h1>
          <p className="hero-sub">
            Sorted Plan uses AI to turn any idea into a perfectly timed day-by-day plan.
            Add checklists, maps, photos — then share with your crew.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={startSignIn}>
              Get started for free
              <ArrowRight size={17} />
            </button>
            <p className="hero-cta-note">Free · No credit card · Google sign-in</p>
          </div>

          {/* App preview pill */}
          <div className="preview-pill">
            <div className="preview-dot" />
            <span>sortedplan.com — your plans, beautifully organised</span>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="features">
        <div className="section-inner">
          <h2 className="section-title">Everything you need to plan anything</h2>
          <p className="section-sub">From a work project to a family vacation — Sorted Plan keeps every detail in one place.</p>

          <div className="feature-grid">
            <div className="feature-card feature-card--primary">
              <div className="feature-icon">
                <Sparkles size={22} />
              </div>
              <h3>AI Itinerary Builder</h3>
              <p>Paste any raw schedule or describe your event — our AI parses it into a structured, time-blocked day plan in seconds.</p>
              <div className="feature-tag">Powered by Gemini & SAP AI</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon--green">
                <Calendar size={22} />
              </div>
              <h3>Visual Timeline</h3>
              <p>Drag and drop activities on an interactive timeline. Add photos, maps links, and notes to every activity.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon--purple">
                <CheckSquare size={22} />
              </div>
              <h3>Smart Checklists</h3>
              <p>AI generates comprehensive packing lists, to-dos, and checklists tailored to any event or project type.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon--orange">
                <Share2 size={22} />
              </div>
              <h3>Share Instantly</h3>
              <p>Generate a shareable link for any plan or checklist. Friends can view without needing an account.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon--blue">
                <MapPin size={22} />
              </div>
              <h3>Maps Integration</h3>
              <p>Attach Google Maps links to any activity. Tap to navigate directly from your plan — no switching apps.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon--pink">
                <Star size={22} />
              </div>
              <h3>Community Templates</h3>
              <p>Browse and use checklist templates published by the community. Publish your own and help others plan better.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="how">
        <div className="section-inner">
          <h2 className="section-title">Up and running in minutes</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h4>Sign in with Google</h4>
              <p>One click — no forms, no passwords.</p>
            </div>
            <div className="step-arrow"><ArrowRight size={18} /></div>
            <div className="step">
              <div className="step-num">2</div>
              <h4>Create a Plan</h4>
              <p>Name your plan, pick dates, let AI draft the schedule.</p>
            </div>
            <div className="step-arrow"><ArrowRight size={18} /></div>
            <div className="step">
              <div className="step-num">3</div>
              <h4>Refine & Share</h4>
              <p>Edit the timeline, add checklists, share the link.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────── */}
      <section className="cta-banner">
        <div className="cta-glow" />
        <div className="section-inner cta-inner">
          <h2>Ready to start planning?</h2>
          <p>Join thousands of people who organise their lives with Sorted Plan.</p>
          <button className="btn-primary btn-primary--lg" onClick={startSignIn}>
            Start planning for free
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="nav-inner">
          <div className="brand">
            <div className="brand-icon brand-icon--sm">
              <img src="/icons/icon-sorted-plan.svg" alt="SortedPlan" width={22} height={22} />
            </div>
            <span className="brand-name brand-name--sm">Sorted<strong>Plan</strong></span>
          </div>
          <p className="footer-copy">© 2026 SortedPlan · sortedplan.com</p>
        </div>
      </footer>

      <style jsx>{`
        /* ── Base ───────────────────────────────── */
        .landing {
          min-height: 100vh;
          background: var(--background);
          color: var(--foreground);
          font-family: inherit;
          overflow-x: hidden;
        }

        /* ── Nav ────────────────────────────────── */
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: color-mix(in srgb, var(--background) 80%, transparent);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }
        .nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .brand-icon img { width: 100%; height: 100%; object-fit: cover; }
        .brand-icon--sm {
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        .brand-name {
          font-size: 18px;
          font-weight: 500;
          color: var(--foreground);
          letter-spacing: -0.02em;
        }
        .brand-name--sm { font-size: 15px; }
        .brand-name strong { font-weight: 800; }
        .nav-signin {
          padding: 8px 20px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .nav-signin:hover { opacity: 0.88; }

        /* ── Hero ───────────────────────────────── */
        .hero {
          position: relative;
          padding: 100px 24px 80px;
          text-align: center;
          overflow: hidden;
        }
        .hero-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .hero-glow-1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: 50%;
          transform: translateX(-60%);
          background: color-mix(in srgb, var(--primary) 18%, transparent);
        }
        .hero-glow-2 {
          width: 400px;
          height: 400px;
          bottom: -100px;
          right: -100px;
          background: color-mix(in srgb, #f093fb 14%, transparent);
        }
        .hero-inner {
          position: relative;
          max-width: 760px;
          margin: 0 auto;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: color-mix(in srgb, var(--primary) 12%, var(--card));
          border: 1px solid color-mix(in srgb, var(--primary) 28%, transparent);
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: var(--primary);
          margin-bottom: 28px;
        }
        .hero-title {
          font-size: clamp(42px, 7vw, 76px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 0 0 24px;
          color: var(--foreground);
        }
        .hero-gradient {
          background: linear-gradient(135deg, var(--primary) 0%, #a78bfa 40%, #f093fb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: clamp(16px, 2.5vw, 20px);
          color: var(--muted-foreground);
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto 40px;
        }
        .hero-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 15px 32px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
          box-shadow: 0 4px 24px color-mix(in srgb, var(--primary) 35%, transparent);
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 45%, transparent);
        }
        .btn-primary--lg {
          padding: 17px 36px;
          font-size: 17px;
          border-radius: 16px;
        }
        .hero-cta-note {
          font-size: 12px;
          color: var(--muted-foreground);
          margin: 0;
        }
        .preview-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 13px;
          color: var(--muted-foreground);
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .preview-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
          flex-shrink: 0;
        }

        /* ── Sections shared ────────────────────── */
        .section-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .section-title {
          font-size: clamp(26px, 4vw, 40px);
          font-weight: 800;
          letter-spacing: -0.025em;
          text-align: center;
          margin: 0 0 14px;
          color: var(--foreground);
        }
        .section-sub {
          font-size: 16px;
          color: var(--muted-foreground);
          text-align: center;
          max-width: 560px;
          margin: 0 auto 56px;
          line-height: 1.6;
        }

        /* ── Features ───────────────────────────── */
        .features {
          padding: 80px 0 100px;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .feature-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px 24px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
        }
        .feature-card--primary {
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 10%, var(--card)),
            color-mix(in srgb, var(--primary) 4%, var(--card))
          );
          border-color: color-mix(in srgb, var(--primary) 22%, transparent);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--primary) 14%, var(--background));
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }
        .feature-icon--green { background: color-mix(in srgb, #10b981 14%, var(--background)); color: #10b981; }
        .feature-icon--purple { background: color-mix(in srgb, #a78bfa 14%, var(--background)); color: #a78bfa; }
        .feature-icon--orange { background: color-mix(in srgb, #f59e0b 14%, var(--background)); color: #f59e0b; }
        .feature-icon--blue { background: color-mix(in srgb, #3b82f6 14%, var(--background)); color: #3b82f6; }
        .feature-icon--pink { background: color-mix(in srgb, #f093fb 14%, var(--background)); color: #ec4899; }
        .feature-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 10px;
          color: var(--foreground);
        }
        .feature-card p {
          font-size: 14px;
          color: var(--muted-foreground);
          line-height: 1.6;
          margin: 0;
        }
        .feature-tag {
          display: inline-block;
          margin-top: 14px;
          padding: 4px 10px;
          background: color-mix(in srgb, var(--primary) 14%, transparent);
          color: var(--primary);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }

        /* ── How it works ───────────────────────── */
        .how {
          padding: 80px 0;
          background: color-mix(in srgb, var(--muted) 40%, var(--background));
        }
        .steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .step {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px 28px 24px;
          text-align: center;
          flex: 1;
          min-width: 200px;
          max-width: 260px;
        }
        .step-num {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          font-size: 18px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .step h4 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--foreground);
        }
        .step p {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
          line-height: 1.5;
        }
        .step-arrow {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        /* ── CTA Banner ─────────────────────────── */
        .cta-banner {
          position: relative;
          padding: 100px 0;
          text-align: center;
          overflow: hidden;
        }
        .cta-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 8%, transparent),
            color-mix(in srgb, #a78bfa 6%, transparent) 50%,
            color-mix(in srgb, #f093fb 5%, transparent)
          );
          pointer-events: none;
        }
        .cta-inner {
          position: relative;
        }
        .cta-banner h2 {
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 800;
          letter-spacing: -0.025em;
          margin: 0 0 16px;
          color: var(--foreground);
        }
        .cta-banner p {
          font-size: 17px;
          color: var(--muted-foreground);
          margin: 0 0 36px;
        }

        /* ── Footer ─────────────────────────────── */
        .footer {
          border-top: 1px solid var(--border);
          padding: 28px 0;
          background: var(--card);
        }
        .footer-copy {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
        }

        /* ── Responsive ─────────────────────────── */
        @media (max-width: 900px) {
          .feature-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .hero { padding: 72px 20px 60px; }
          .feature-grid { grid-template-columns: 1fr; }
          .step-arrow { display: none; }
          .step { min-width: 0; max-width: 100%; width: 100%; }
          .steps { flex-direction: column; }
          .nav-inner, .section-inner { padding: 0 20px; }
          .cta-banner { padding: 72px 0; }
        }
      `}</style>
    </div>
  );
}
