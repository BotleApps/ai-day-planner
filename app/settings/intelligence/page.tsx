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
  ExternalLink,
  Key,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  AIProvider,
  AISettings,
  AIModelOption,
  loadAISettings,
  saveAISettings,
  isAIConfigured,
  loadAISettingsFromServer,
  saveAISettingsToServer,
  DEFAULT_AI_SETTINGS,
} from '@/lib/ai-settings';
import type { GeminiModel } from '@/lib/gemini';

type Status = 'idle' | 'testing' | 'success' | 'error';
type View = 'select' | 'configure';

const SAP_BACKEND_LABEL: Record<string, string> = {
  openai: 'Azure OpenAI',
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
};

const SAP_BACKEND_COLOR: Record<string, string> = {
  openai: '#0078d4',
  bedrock: '#ff9900',
  vertex: '#4285f4',
};

export default function IntelligencePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [activeTab, setActiveTab] = useState<AIProvider>('gemini');
  const [view, setView] = useState<View>('select');

  // SAP state
  const [sapModels, setSapModels] = useState<AIModelOption[]>([]);
  const [sapStatus, setSapStatus] = useState<Status>('idle');
  const [sapError, setSapError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isDiscoveringSap, setIsDiscoveringSap] = useState(false);

  // Gemini state
  const [geminiModels, setGeminiModels] = useState<GeminiModel[]>([]);
  const [geminiStatus, setGeminiStatus] = useState<Status>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isFetchingGemini, setIsFetchingGemini] = useState(false);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const local = loadAISettings();
    setSettings(local);
    if (isAIConfigured(local)) {
      setActiveTab(local.provider || 'gemini');
      setView('configure');
    }
    loadAISettingsFromServer().then(serverSettings => {
      if (serverSettings.clientId || serverSettings.deploymentId || serverSettings.geminiApiKey) {
        setSettings(serverSettings);
        saveAISettings(serverSettings);
        setActiveTab(serverSettings.provider || 'gemini');
        setView('configure');
      }
    });
  }, []);

  const update = (patch: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleTabChange = (tab: AIProvider) => {
    setActiveTab(tab);
    update({ provider: tab });
  };

  const selectProvider = (provider: AIProvider) => {
    setActiveTab(provider);
    update({ provider });
    setView('configure');
  };

  const handleSave = async () => {
    await saveAISettingsToServer({ ...settings, provider: activeTab, enabled: true });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push('/settings');
    }, 900);
  };

  const handleDisconnect = async () => {
    const reset = { ...DEFAULT_AI_SETTINGS, enabled: false };
    await saveAISettingsToServer(reset);
    setSettings(reset);
    setSapModels([]);
    setGeminiModels([]);
    setSapStatus('idle');
    setGeminiStatus('idle');
    setView('select');
    router.push('/settings');
  };

  // ── SAP discovery ──────────────────────────────────────────────────────
  const handleDiscoverSap = async () => {
    if (!settings.clientId || !settings.clientSecret || !settings.authUrl || !settings.apiUrl) {
      setSapStatus('error');
      setSapError('Fill in Client ID, Client Secret, Auth URL and API URL first.');
      return;
    }
    setIsDiscoveringSap(true);
    setSapStatus('testing');
    setSapError('');
    setSapModels([]);

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
        setSapStatus('error');
        setSapError(data.error || `HTTP ${resp.status}`);
        return;
      }
      setSapModels(data.models || []);
      setSapStatus('success');
      if (!settings.deploymentId && data.models?.length > 0) {
        const first = data.models[0];
        update({ deploymentId: first.deploymentId, backend: first.backend, modelName: first.name });
      }
    } catch (err) {
      setSapStatus('error');
      setSapError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsDiscoveringSap(false);
    }
  };

  const handleSelectSapModel = (m: AIModelOption) => {
    update({ deploymentId: m.deploymentId, backend: m.backend, modelName: m.name });
  };

  // ── Gemini model fetch ─────────────────────────────────────────────────
  const handleFetchGeminiModels = async () => {
    if (!settings.geminiApiKey?.trim()) {
      setGeminiStatus('error');
      setGeminiError('Enter your Google AI Studio API key first.');
      return;
    }
    setIsFetchingGemini(true);
    setGeminiStatus('testing');
    setGeminiError('');
    setGeminiModels([]);

    try {
      const resp = await fetch('/api/ai/gemini-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.geminiApiKey }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setGeminiStatus('error');
        setGeminiError(data.error || `HTTP ${resp.status}`);
        return;
      }
      setGeminiModels(data.models || []);
      setGeminiStatus('success');
      if (!settings.geminiModel && data.models?.length > 0) {
        update({ geminiModel: data.models[0].name });
      }
    } catch (err) {
      setGeminiStatus('error');
      setGeminiError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsFetchingGemini(false);
    }
  };

  const handleSelectGeminiModel = (m: GeminiModel) => {
    update({ geminiModel: m.name });
  };

  const isConnected =
    activeTab === 'sap'
      ? !!settings.deploymentId && !!settings.clientId
      : !!settings.geminiModel && !!settings.geminiApiKey;

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <button
          className="back-btn"
          onClick={() => view === 'configure' && !isAIConfigured(settings) ? setView('select') : router.push('/settings')}
        >
          <ArrowLeft size={18} />
          {view === 'configure' && !isAIConfigured(settings) ? 'Back' : 'Settings'}
        </button>
        <h1>AI Intelligence</h1>
        {view === 'configure' ? (
          <button
            className={`save-btn ${saved ? 'saving' : ''}`}
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        ) : (
          <div style={{ width: 72 }} />
        )}
      </header>

      {/* ── Provider selection screen ─────────────────────────── */}
      {view === 'select' && (
        <div className="scroll">
          <div className="select-intro">
            <div className="select-icon">
              <Sparkles size={28} />
            </div>
            <h2 className="select-title">Choose AI Provider</h2>
            <p className="select-sub">Select the AI service you want to connect to power your planning assistant.</p>
          </div>

          <div className="provider-cards">
            {/* Google Gemini — first / recommended */}
            <button className="provider-card provider-card--gemini" onClick={() => selectProvider('gemini')}>
              <div className="pcard-icon pcard-icon--gemini">
                <Bot size={24} />
              </div>
              <div className="pcard-body">
                <div className="pcard-name-row">
                  <span className="pcard-name">Google Gemini</span>
                  <span className="pcard-badge">Recommended</span>
                </div>
                <span className="pcard-desc">Gemini 2.5 Pro, Flash, and more — free API key from Google AI Studio</span>
              </div>
              <ChevronRight size={18} className="pcard-arrow" />
            </button>

            {/* SAP AI Core */}
            <button className="provider-card provider-card--sap" onClick={() => selectProvider('sap')}>
              <div className="pcard-icon pcard-icon--sap">
                <Bot size={24} />
              </div>
              <div className="pcard-body">
                <span className="pcard-name">SAP AI Core</span>
                <span className="pcard-desc">Generative AI Hub — GPT, Claude, Gemini via SAP BTP service key</span>
              </div>
              <ChevronRight size={18} className="pcard-arrow" />
            </button>
          </div>
        </div>
      )}

      {/* ── Configure screen ──────────────────────────────────── */}
      {view === 'configure' && (
      <div className="scroll">

        {/* Provider tabs */}
        <div className="tab-row">
          <button
            className={`tab-btn ${activeTab === 'gemini' ? 'active' : ''}`}
            onClick={() => handleTabChange('gemini')}
          >
            <span className="tab-dot gemini-dot" />
            Google Gemini
          </button>
          <button
            className={`tab-btn ${activeTab === 'sap' ? 'active' : ''}`}
            onClick={() => handleTabChange('sap')}
          >
            <span className="tab-dot sap-dot" />
            SAP AI Core
          </button>
        </div>

        {/* Provider badge */}
        <div className="provider-row">
          <div className={`provider-icon ${activeTab === 'gemini' ? 'gemini-icon' : ''}`}>
            <Bot size={22} />
          </div>
          <div className="provider-info">
            {activeTab === 'sap' ? (
              <>
                <span className="provider-name">SAP AI Core</span>
                <span className="provider-subtitle">Generative AI Hub — GPT · Claude · Gemini</span>
              </>
            ) : (
              <>
                <span className="provider-name">Google Gemini</span>
                <span className="provider-subtitle">Gemini 2.5 Pro · Flash · and more</span>
              </>
            )}
          </div>
          {isConnected && (
            <span className="connected-badge">
              <CheckCircle2 size={12} />
              Connected
            </span>
          )}
        </div>

        {/* ── SAP AI CORE TAB ───────────────────────────────────────────── */}
        {activeTab === 'sap' && (
          <>
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

            <div className="group-label">Model</div>
            <div className="group">
              <div className="discover-row">
                <button
                  className="discover-btn"
                  onClick={handleDiscoverSap}
                  disabled={isDiscoveringSap}
                >
                  {isDiscoveringSap
                    ? <Loader2 size={15} className="spin" />
                    : <RefreshCw size={15} />}
                  {isDiscoveringSap ? 'Connecting…' : 'Discover Deployments'}
                </button>
                {sapStatus === 'success' && (
                  <span className="chip ok">
                    <CheckCircle2 size={12} />
                    {sapModels.length} found
                  </span>
                )}
                {sapStatus === 'error' && (
                  <span className="chip err">
                    <XCircle size={12} />
                    Failed
                  </span>
                )}
              </div>

              {sapStatus === 'error' && sapError && (
                <div className="error-banner">
                  <XCircle size={13} />
                  {sapError}
                </div>
              )}

              {sapModels.length > 0 && (
                <div className="model-list">
                  {sapModels.map((m, i) => (
                    <div key={m.deploymentId}>
                      {i > 0 && <div className="sep" />}
                      <button
                        className={`model-row ${settings.deploymentId === m.deploymentId ? 'selected' : ''}`}
                        onClick={() => handleSelectSapModel(m)}
                      >
                        <div className="model-left">
                          <span
                            className="backend-dot"
                            style={{ background: SAP_BACKEND_COLOR[m.backend] || '#888' }}
                          />
                          <div className="model-info">
                            <span className="model-name">{m.name}</span>
                            <span className="model-backend">{SAP_BACKEND_LABEL[m.backend] || m.backend}</span>
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

              {sapModels.length === 0 && settings.deploymentId && sapStatus === 'idle' && (
                <div className="saved-row">
                  <span
                    className="backend-dot"
                    style={{ background: SAP_BACKEND_COLOR[settings.backend] || '#888' }}
                  />
                  <div className="model-info">
                    <span className="model-name">{settings.modelName || settings.deploymentId}</span>
                    <span className="model-backend">{SAP_BACKEND_LABEL[settings.backend] || settings.backend}</span>
                  </div>
                  <CheckCircle2 size={16} className="model-check" />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── GOOGLE GEMINI TAB ─────────────────────────────────────────── */}
        {activeTab === 'gemini' && (
          <>
            {/* Get API key link */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="studio-link"
            >
              <Key size={15} />
              Get API key from Google AI Studio
              <ExternalLink size={13} className="ext-icon" />
            </a>

            <div className="group-label">API Key</div>
            <div className="group">
              <div className="field-row">
                <label>Google AI Studio Key</label>
                <div className="secret-wrap">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={settings.geminiApiKey}
                    onChange={e => update({ geminiApiKey: e.target.value })}
                    placeholder="AIza••••••••••••••••••••••••••••••••••••••"
                    autoComplete="new-password"
                  />
                  <button className="eye-btn" onClick={() => setShowGeminiKey(p => !p)} type="button">
                    {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="hint">Paste your API key from Google AI Studio</span>
              </div>
            </div>

            <div className="group-label">Model</div>
            <div className="group">
              <div className="discover-row">
                <button
                  className="discover-btn gemini-discover-btn"
                  onClick={handleFetchGeminiModels}
                  disabled={isFetchingGemini}
                >
                  {isFetchingGemini
                    ? <Loader2 size={15} className="spin" />
                    : <RefreshCw size={15} />}
                  {isFetchingGemini ? 'Loading…' : 'Load Available Models'}
                </button>
                {geminiStatus === 'success' && (
                  <span className="chip ok">
                    <CheckCircle2 size={12} />
                    {geminiModels.length} models
                  </span>
                )}
                {geminiStatus === 'error' && (
                  <span className="chip err">
                    <XCircle size={12} />
                    Failed
                  </span>
                )}
              </div>

              {geminiStatus === 'error' && geminiError && (
                <div className="error-banner">
                  <XCircle size={13} />
                  {geminiError}
                </div>
              )}

              {geminiModels.length > 0 && (
                <div className="model-list">
                  {geminiModels.map((m, i) => (
                    <div key={m.name}>
                      {i > 0 && <div className="sep" />}
                      <button
                        className={`model-row ${settings.geminiModel === m.name ? 'selected' : ''}`}
                        onClick={() => handleSelectGeminiModel(m)}
                      >
                        <div className="model-left">
                          <span className="backend-dot" style={{ background: '#4285f4' }} />
                          <div className="model-info">
                            <span className="model-name">{m.displayName}</span>
                            <span className="model-backend">{m.name}</span>
                          </div>
                        </div>
                        {settings.geminiModel === m.name && (
                          <CheckCircle2 size={17} className="model-check" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {geminiModels.length === 0 && settings.geminiModel && geminiStatus === 'idle' && (
                <div className="saved-row">
                  <span className="backend-dot" style={{ background: '#4285f4' }} />
                  <div className="model-info">
                    <span className="model-name">{settings.geminiModel}</span>
                    <span className="model-backend">Google Gemini</span>
                  </div>
                  <CheckCircle2 size={16} className="model-check" />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Disconnect ─────────────────────────────────────────────────── */}
        {(settings.deploymentId || settings.clientId || settings.geminiApiKey || settings.geminiModel) && (
          <>
            <div className="group-label">Manage</div>
            <div className="group">
              <button className="danger-row" onClick={handleDisconnect}>
                <Trash2 size={16} />
                Disconnect & Clear All Configuration
              </button>
            </div>
          </>
        )}

        <p className="privacy">
          Credentials are encrypted and stored securely on the server, synced across all your devices.
        </p>
      </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }

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

        .scroll {
          max-width: 540px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 20px 56px;
        }

        /* Provider tabs */
        .tab-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          background: var(--muted);
          border-radius: 12px;
          padding: 4px;
        }
        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 12px;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: var(--muted-foreground);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
        }
        .tab-btn.active {
          background: var(--card);
          color: var(--foreground);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .tab-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sap-dot  { background: #00c2a8; }
        .gemini-dot { background: #4285f4; }

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
        .provider-icon.gemini-icon {
          background: linear-gradient(135deg, #e8f0fe, #d2e3fc);
          color: #4285f4;
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

        /* Google AI Studio link */
        .studio-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: color-mix(in srgb, #4285f4 8%, var(--card));
          border: 1px solid color-mix(in srgb, #4285f4 25%, transparent);
          border-radius: 12px;
          color: #4285f4;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 20px;
          transition: background 0.15s;
        }
        .studio-link:hover {
          background: color-mix(in srgb, #4285f4 14%, var(--card));
        }
        .ext-icon { margin-left: auto; opacity: 0.7; }

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

        .group {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .sep { height: 1px; background: var(--border); margin: 0 16px; }

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
          padding: 11px 14px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--background);
          color: var(--foreground);
          font-size: 14px;
          width: 100%;
          outline: none;
          min-height: 44px;
          box-sizing: border-box;
          -webkit-appearance: none;
          transition: border-color 0.15s;
        }
        .field-row input:focus { border-color: var(--primary); }
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
        .secret-wrap input { flex: 1; padding-right: 44px; }
        .eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: var(--muted-foreground);
          cursor: pointer;
          display: flex;
          padding: 4px;
        }
        .eye-btn:hover { color: var(--foreground); }

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
        .gemini-discover-btn { background: #4285f4; }
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

        /* ── Provider selection screen ─────────────── */
        .select-intro {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px 0 36px;
        }
        .select-icon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: color-mix(in srgb, var(--primary) 14%, var(--card));
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .select-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--foreground);
          margin: 0 0 10px;
          letter-spacing: -0.02em;
        }
        .select-sub {
          font-size: 14px;
          color: var(--muted-foreground);
          max-width: 340px;
          line-height: 1.6;
          margin: 0;
        }
        .provider-cards {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .provider-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 18px;
          cursor: pointer;
          text-align: left;
          transition: all 0.18s;
          width: 100%;
        }
        .provider-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.1);
        }
        .provider-card--gemini {
          border-color: color-mix(in srgb, #4285f4 30%, transparent);
          background: color-mix(in srgb, #4285f4 4%, var(--card));
        }
        .provider-card--gemini:hover {
          border-color: #4285f4;
          box-shadow: 0 6px 24px color-mix(in srgb, #4285f4 20%, transparent);
        }
        .provider-card--sap:hover {
          border-color: var(--primary);
          box-shadow: 0 6px 24px color-mix(in srgb, var(--primary) 18%, transparent);
        }
        .pcard-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pcard-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pcard-icon--gemini {
          background: linear-gradient(135deg, #e8f0fe, #d2e3fc);
          color: #4285f4;
        }
        .pcard-icon--sap {
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 18%, var(--card)),
            color-mix(in srgb, var(--primary) 8%, var(--card))
          );
          color: var(--primary);
        }
        .pcard-badge {
          padding: 3px 9px;
          background: #4285f4;
          color: white;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .pcard-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .pcard-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
        }
        .pcard-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          line-height: 1.4;
        }
        .pcard-arrow {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
