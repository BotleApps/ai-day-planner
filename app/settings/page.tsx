'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Bot,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { loadAISettings, saveAISettings, isAIConfigured, loadAISettingsFromServer, saveAISettingsToServer } from '@/lib/ai-settings';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiModelName, setAiModelName] = useState('');
  const [aiBackend, setAiBackend] = useState('');

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrating settings from localStorage/server on mount */
    setMounted(true);
    // Load from localStorage immediately (no flash)
    const local = loadAISettings();
    setAiEnabled(local.enabled);
    setAiConfigured(isAIConfigured(local));
    setAiModelName(local.modelName || local.deploymentId || '');
    setAiBackend(local.backend || '');
    /* eslint-enable react-hooks/set-state-in-effect */
    // Sync from server (authoritative cross-device)
    loadAISettingsFromServer().then(s => {
      if (s.clientId || s.deploymentId) {
        saveAISettings(s);
        setAiEnabled(s.enabled);
        setAiConfigured(isAIConfigured(s));
        setAiModelName(s.modelName || s.deploymentId || '');
        setAiBackend(s.backend || '');
      }
    });
  }, []);

  const handleToggleAI = (checked: boolean) => {
    setAiEnabled(checked);
    const s = loadAISettings();
    const updated = { ...s, enabled: checked };
    saveAISettingsToServer(updated);
  };

  const THEME_OPTIONS = [
    { value: 'light', icon: <Sun size={16} />, label: 'Light' },
    { value: 'dark', icon: <Moon size={16} />, label: 'Dark' },
    { value: 'system', icon: <Monitor size={16} />, label: 'System' },
  ];

  const BACKEND_LABEL: Record<string, string> = {
    openai: 'Azure OpenAI',
    bedrock: 'AWS Bedrock',
    vertex: 'Google Vertex AI',
  };

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <button className="back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={18} />
          Back
        </button>
        <h1>Settings</h1>
        <div style={{ width: 72 }} />
      </header>

      <div className="scroll">

        {/* ── Account ────────────────────────────── */}
        {session?.user && (
          <>
            <div className="group-label">Account</div>
            <div className="group">
              <div className="row no-hover">
                <div className="row-left">
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? 'User'}
                      className="avatar"
                      width={30}
                      height={30}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="avatar-fallback">
                      {session.user.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                  )}
                  <div className="row-text">
                    <span className="row-title">{session.user.name ?? 'Signed in'}</span>
                    <span className="row-desc">{session.user.email}</span>
                  </div>
                </div>
                <button
                  className="sign-out-btn"
                  onClick={() => signOut({ callbackUrl: '/sign-in' })}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Appearance ─────────────────────────── */}
        <div className="group-label">Appearance</div>
        <div className="group">
          <div className="row no-hover theme-row">
            <div className="row-left">
              <span className="row-icon" style={{ background: '#f59e0b' }}>
                <Sun size={15} />
              </span>
              <span className="row-title">Theme</span>
            </div>
            {mounted && (
              <div className="theme-pills">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`theme-pill ${theme === opt.value ? 'active' : ''}`}
                    onClick={() => setTheme(opt.value)}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Intelligence ───────────────────────── */}
        <div className="group-label">Intelligence</div>
        <div className="group">
          {/* Toggle row */}
          <div className="row no-hover">
            <div className="row-left">
              <span className="row-icon" style={{ background: 'var(--primary)' }}>
                <Sparkles size={15} />
              </span>
              <div className="row-text">
                <span className="row-title">Enable Intelligence</span>
                <span className="row-desc">Connect an AI provider to power the assistant</span>
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={e => handleToggleAI(e.target.checked)}
              />
              <span className="toggle-track" />
            </label>
          </div>

          {/* Divider + sub-rows only when enabled */}
          {aiEnabled && (
            <>
              <div className="divider" />

              {aiConfigured ? (
                /* Configured — show summary, tap to manage */
                <button className="row" onClick={() => router.push('/settings/intelligence')}>
                  <div className="row-left">
                    <span className="row-icon" style={{ background: '#10b981' }}>
                      <Bot size={15} />
                    </span>
                    <div className="row-text">
                      <span className="row-title">AI Provider</span>
                      <span className="row-desc">
                        {aiModelName || 'Model configured'}
                        {aiBackend ? ` · ${BACKEND_LABEL[aiBackend] || aiBackend}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="row-right">
                    <span className="badge-ok">
                      <CheckCircle2 size={12} />
                      Connected
                    </span>
                    <ChevronRight size={16} className="chevron" />
                  </div>
                </button>
              ) : (
                /* Not configured — prompt to configure */
                <button className="row" onClick={() => router.push('/settings/intelligence')}>
                  <div className="row-left">
                    <span className="row-icon" style={{ background: '#ef4444' }}>
                      <AlertCircle size={15} />
                    </span>
                    <div className="row-text">
                      <span className="row-title">Configure AI Provider</span>
                      <span className="row-desc">Add your credentials to get started</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="chevron" />
                </button>
              )}
            </>
          )}
        </div>

      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 56px;
          border-bottom: 1px solid var(--border);
          background: var(--card);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .header h1 {
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--foreground);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .back-btn:hover { background: var(--muted); }

        /* Scroll area */
        .scroll {
          max-width: 540px;
          width: 100%;
          margin: 0 auto;
          padding: 28px 20px 48px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* Group label */
        .group-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          padding: 0 4px 8px;
          margin-top: 24px;
        }
        .group-label:first-child { margin-top: 0; }

        /* Group card */
        .group {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        /* Row */
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: default;
          transition: background 0.12s;
        }
        .row:not(.no-hover) { cursor: pointer; }
        .row:not(.no-hover):hover { background: var(--muted); }

        .row-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .row-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .row-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
          white-space: nowrap;
        }
        .row-desc {
          font-size: 12px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .row-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .chevron {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        .divider {
          height: 1px;
          background: var(--border);
          margin: 0 16px;
        }

        /* Toggle */
        .toggle {
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }
        .toggle input { display: none; }
        .toggle-track {
          position: absolute;
          inset: 0;
          background: var(--muted);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s;
          border: 1px solid var(--border);
        }
        .toggle-track::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle input:checked + .toggle-track {
          background: var(--primary);
          border-color: var(--primary);
        }
        .toggle input:checked + .toggle-track::after { transform: translateX(20px); }

        /* Theme pills */
        .theme-row {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }
        .theme-pills {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .theme-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 8px 12px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--background);
          color: var(--muted-foreground);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .theme-pill:hover { border-color: var(--primary); color: var(--foreground); }
        .theme-pill.active {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 12%, var(--background));
          color: var(--primary);
        }

        /* Account */
        .avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1.5px solid var(--border);
          object-fit: cover;
          flex-shrink: 0;
        }

        .avatar-fallback {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sign-out-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted-foreground);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .sign-out-btn:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.06);
        }

        /* Connected badge */
        .badge-ok {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          background: color-mix(in srgb, #10b981 15%, var(--card));
          color: #059669;
          border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        @media (max-width: 480px) {
          .row { padding: 12px 14px; }
        }
      `}</style>
    </div>
  );
}
