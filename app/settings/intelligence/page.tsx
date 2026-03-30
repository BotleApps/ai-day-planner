'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Bot,
  Trash2,
} from 'lucide-react';
import {
  AISettings,
  AIModelOption,
  loadAISettings,
  saveAISettings,
  DEFAULT_AI_SETTINGS,
} from '@/lib/ai-settings';

type Status = 'idle' | 'testing' | 'success' | 'error';

const BACKEND_LABEL: Record<string, string> = {
  openai: 'Azure OpenAI',
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
};

const BACKEND_COLOR: Record<string, string> = {
  openai: '#0078d4',
  bedrock: '#ff9900',
  vertex: '#4285f4',
};

export default function IntelligencePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadAISettings());
  }, []);

  const update = (patch: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    saveAISettings(settings);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push('/settings');
    }, 900);
  };

  const handleDisconnect = () => {
    const reset = { ...DEFAULT_AI_SETTINGS, enabled: false };
    saveAISettings(reset);
    setSettings(reset);
    setModels([]);
    setStatus('idle');
    router.push('/settings');
  };

  const handleDiscover = async () => {
    if (!settings.clientId || !settings.clientSecret || !settings.authUrl || !settings.apiUrl) {
      setStatus('error');
      setErrorMsg('Fill in Client ID, Client Secret, Auth URL and API URL first.');
      return;
    }
    setIsDiscovering(true);
    setStatus('testing');
    setErrorMsg('');
    setModels([]);

    try {
      const resp = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: settings.clientId,
          clientSecret: settings.clientSecret,
          authUrl: settings.authUrl,
          apiUrl: settings.apiUrl,
          resourceGroup: settings.resourceGroup || 'default',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus('error');
        setErrorMsg(data.error || `HTTP ${resp.status}`);
        return;
      }
      setModels(data.models || []);
      setStatus('success');
      if (!settings.deploymentId && data.models?.length > 0) {
        const first = data.models[0];
        update({ deploymentId: first.deploymentId, backend: first.backend, modelName: first.name });
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSelectModel = (m: AIModelOption) => {
    update({ deploymentId: m.deploymentId, backend: m.backend, modelName: m.name });
  };

  const isConnected = !!settings.deploymentId && status === 'idle' && !!settings.clientId;

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <button className="back-btn" onClick={() => router.push('/settings')}>
          <ArrowLeft size={18} />
          Settings
        </button>
        <h1>SAP AI Core</h1>
        <button
          className={`save-btn ${saved ? 'saving' : ''}`}
          onClick={handleSave}
          disabled={saved}
        >
          {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </header>

      <div className="scroll">

        {/* Provider badge */}
        <div className="provider-row">
          <div className="provider-icon">
            <Bot size={22} />
          </div>
          <div className="provider-info">
            <span className="provider-name">SAP AI Core</span>
            <span className="provider-subtitle">Generative AI Hub — GPT · Claude · Gemini</span>
          </div>
          {settings.deploymentId && (
            <span className="connected-badge">
              <CheckCircle2 size={12} />
              Connected
            </span>
          )}
        </div>

        {/* ── Credentials ───────────────────────── */}
        <div className="group-label">Service Key</div>
        <div className="group">
          <div className="field-row">
            <label>Auth URL</label>
            <input
              type="url"
              value={settings.authUrl}
              onChange={e => update({ authUrl: e.target.value })}
              placeholder="https://subdomain.authentication.eu10.hana.ondemand.com"
              autoComplete="off"
            />
            <span className="hint">The <code>url</code> field in your service key</span>
          </div>
          <div className="sep" />
          <div className="field-row">
            <label>API URL</label>
            <input
              type="url"
              value={settings.apiUrl}
              onChange={e => update({ apiUrl: e.target.value })}
              placeholder="https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com"
              autoComplete="off"
            />
            <span className="hint">The <code>serviceurls.AI_API_URL</code> field</span>
          </div>
          <div className="sep" />
          <div className="field-row">
            <label>Client ID</label>
            <input
              type="text"
              value={settings.clientId}
              onChange={e => update({ clientId: e.target.value })}
              placeholder="sb-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx!b..."
              autoComplete="off"
            />
          </div>
          <div className="sep" />
          <div className="field-row">
            <label>Client Secret</label>
            <div className="secret-wrap">
              <input
                type={showSecret ? 'text' : 'password'}
                value={settings.clientSecret}
                onChange={e => update({ clientSecret: e.target.value })}
                placeholder="••••••••••••••••"
                autoComplete="new-password"
              />
              <button className="eye-btn" onClick={() => setShowSecret(p => !p)} type="button">
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="sep" />
          <div className="field-row">
            <label>Resource Group</label>
            <input
              type="text"
              value={settings.resourceGroup}
              onChange={e => update({ resourceGroup: e.target.value })}
              placeholder="default"
            />
            <span className="hint">Usually <code>default</code></span>
          </div>
        </div>

        {/* ── Model discovery ────────────────────── */}
        <div className="group-label">Model</div>
        <div className="group">
          {/* Discover button row */}
          <div className="discover-row">
            <button
              className="discover-btn"
              onClick={handleDiscover}
              disabled={isDiscovering}
            >
              {isDiscovering
                ? <Loader2 size={15} className="spin" />
                : <RefreshCw size={15} />}
              {isDiscovering ? 'Connecting…' : 'Discover Deployments'}
            </button>

            {status === 'success' && (
              <span className="chip ok">
                <CheckCircle2 size={12} />
                {models.length} found
              </span>
            )}
            {status === 'error' && (
              <span className="chip err">
                <XCircle size={12} />
                Failed
              </span>
            )}
          </div>

          {status === 'error' && errorMsg && (
            <div className="error-banner">
              <XCircle size={13} />
              {errorMsg}
            </div>
          )}

          {/* Model list after discovery */}
          {models.length > 0 && (
            <div className="model-list">
              {models.map((m, i) => (
                <div key={m.deploymentId}>
                  {i > 0 && <div className="sep" />}
                  <button
                    className={`model-row ${settings.deploymentId === m.deploymentId ? 'selected' : ''}`}
                    onClick={() => handleSelectModel(m)}
                  >
                    <div className="model-left">
                      <span
                        className="backend-dot"
                        style={{ background: BACKEND_COLOR[m.backend] || '#888' }}
                      />
                      <div className="model-info">
                        <span className="model-name">{m.name}</span>
                        <span className="model-backend">{BACKEND_LABEL[m.backend] || m.backend}</span>
                      </div>
                    </div>
                    {settings.deploymentId === m.deploymentId && (
                      <CheckCircle2 size={17} className="model-check" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Saved model summary (before discover) */}
          {models.length === 0 && settings.deploymentId && status === 'idle' && (
            <div className="saved-row">
              <span
                className="backend-dot"
                style={{ background: BACKEND_COLOR[settings.backend] || '#888' }}
              />
              <div className="model-info">
                <span className="model-name">{settings.modelName || settings.deploymentId}</span>
                <span className="model-backend">{BACKEND_LABEL[settings.backend] || settings.backend}</span>
              </div>
              <CheckCircle2 size={16} className="model-check" />
            </div>
          )}
        </div>

        {/* ── Danger zone ───────────────────────── */}
        {(settings.deploymentId || settings.clientId) && (
          <>
            <div className="group-label">Manage</div>
            <div className="group">
              <button className="danger-row" onClick={handleDisconnect}>
                <Trash2 size={16} />
                Disconnect & Clear Configuration
              </button>
            </div>
          </>
        )}

        <p className="privacy">
          Credentials are stored only in your browser and sent to your Next.js server — never to third parties.
        </p>
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
          gap: 5px;
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

        .save-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          min-width: 72px;
          justify-content: center;
        }
        .save-btn:hover:not(:disabled) { opacity: 0.88; }
        .save-btn.saving { background: #10b981; }

        /* Scroll area */
        .scroll {
          max-width: 540px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 20px 56px;
        }

        /* Provider row */
        .provider-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          margin-bottom: 28px;
        }
        .provider-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 18%, var(--card)),
            color-mix(in srgb, var(--primary) 8%, var(--card))
          );
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          flex-shrink: 0;
        }
        .provider-info { flex: 1; }
        .provider-name {
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: var(--foreground);
        }
        .provider-subtitle {
          display: block;
          font-size: 12px;
          color: var(--muted-foreground);
          margin-top: 2px;
        }
        .connected-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: color-mix(in srgb, #10b981 15%, var(--card));
          color: #059669;
          border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
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

        /* Group card */
        .group {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        /* Separator */
        .sep { height: 1px; background: var(--border); margin: 0 16px; }

        /* Field rows */
        .field-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
        }
        .field-row label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .field-row input {
          padding: 0;
          border: none;
          background: transparent;
          color: var(--foreground);
          font-size: 14px;
          width: 100%;
          outline: none;
        }
        .field-row input::placeholder { color: color-mix(in srgb, var(--muted-foreground) 60%, transparent); }
        .hint {
          font-size: 11px;
          color: var(--muted-foreground);
        }
        .hint code {
          background: var(--muted);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 10px;
        }

        .secret-wrap { position: relative; display: flex; align-items: center; }
        .secret-wrap input { flex: 1; padding-right: 28px; }
        .eye-btn {
          position: absolute;
          right: 0;
          background: none;
          border: none;
          color: var(--muted-foreground);
          cursor: pointer;
          display: flex;
          padding: 4px;
        }
        .eye-btn:hover { color: var(--foreground); }

        /* Discover row */
        .discover-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          flex-wrap: wrap;
        }
        .discover-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .discover-btn:hover:not(:disabled) { opacity: 0.88; }
        .discover-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .chip.ok {
          background: color-mix(in srgb, #10b981 15%, var(--card));
          color: #059669;
          border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
        }
        .chip.err {
          background: color-mix(in srgb, #ef4444 15%, var(--card));
          color: #dc2626;
          border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin: 0 16px 14px;
          padding: 10px 14px;
          background: color-mix(in srgb, #ef4444 8%, var(--card));
          border: 1px solid color-mix(in srgb, #ef4444 22%, transparent);
          border-radius: 9px;
          font-size: 12px;
          color: #dc2626;
          line-height: 1.4;
        }

        /* Model list */
        .model-list { padding: 0; }
        .model-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 16px;
          width: 100%;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.12s;
          text-align: left;
        }
        .model-row:hover { background: var(--muted); }
        .model-row.selected { background: color-mix(in srgb, var(--primary) 7%, var(--card)); }

        .saved-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
        }

        .model-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .backend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .model-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .model-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .model-backend {
          font-size: 11px;
          color: var(--muted-foreground);
        }
        .model-check { color: var(--primary); flex-shrink: 0; }

        /* Danger row */
        .danger-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          width: 100%;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #ef4444;
          transition: background 0.12s;
          text-align: left;
        }
        .danger-row:hover { background: color-mix(in srgb, #ef4444 8%, var(--card)); }

        /* Privacy note */
        .privacy {
          font-size: 12px;
          color: var(--muted-foreground);
          padding: 20px 4px 0;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 480px) {
          .scroll { padding: 20px 16px 48px; }
        }
      `}</style>
    </div>
  );
}
