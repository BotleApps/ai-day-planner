'use client';

import { signIn } from 'next-auth/react';
import { Sparkles } from 'lucide-react';

export default function SignInClient() {
  return (
    <div className="sign-in-container">
      <div className="sign-in-card">
        <div className="logo-icon">
          <Sparkles size={28} />
        </div>
        <h1>AI Day Planner</h1>
        <p>Sign in to create and manage your travel plans</p>

        <button
          className="google-btn"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
      </div>

      <style jsx>{`
        .sign-in-container {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background);
          padding: 24px;
        }

        .sign-in-card {
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          text-align: center;
        }

        .logo-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 20px;
        }

        h1 {
          font-size: 26px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 8px;
        }

        p {
          font-size: 15px;
          color: var(--muted-foreground);
          line-height: 1.5;
          margin: 0 0 32px;
        }

        .google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.2s;
        }

        .google-btn:hover {
          border-color: var(--primary);
          background: var(--muted);
        }

        .google-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
