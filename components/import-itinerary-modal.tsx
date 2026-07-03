'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Upload,
  FileUp,
} from 'lucide-react';
import { loadAISettingsFromServer, isAIConfigured } from '@/lib/ai-settings';
import { DayPlan, DEFAULT_PREFERENCES } from '@/lib/types';
import { ACTIVITY_ICONS } from '@/lib/types';

interface ParsedPreview {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  days: DayPlan[];
}

interface ImportItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated: (planId: string) => void;
  mode?: 'import' | 'generate';
}

type Stage = 'input' | 'extracting' | 'parsing' | 'preview' | 'creating' | 'error';

export function ImportItineraryModal({ isOpen, onClose, onPlanCreated, mode = 'import' }: ImportItineraryModalProps) {
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedPreview | null>(null);
  const [error, setError] = useState('');
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [aiConfigured, setAiConfigured] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadAISettingsFromServer().then(serverSettings => {
      setAiConfigured(isAIConfigured(serverSettings));
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!text.trim()) return;
    setStage('parsing');
    setError('');

    try {
      const resp = await fetch('/api/ai/parse-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || `HTTP ${resp.status}`);
        setStage('error');
        return;
      }

      setParsed(data);
      setStage('preview');
      setExpandedDay(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStage('error');
    }
  };

  const handleCreate = async () => {
    if (!parsed) return;
    setStage('creating');

    try {
      const resp = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsed.title,
          destination: parsed.destination,
          description: parsed.description,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          preferences: DEFAULT_PREFERENCES,
          days: parsed.days, // pre-populated
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Failed to create plan');
        setStage('error');
        return;
      }

      onPlanCreated(data.plan._id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStage('error');
    }
  };

  const handleClose = () => {
    setStage('input');
    setText('');
    setParsed(null);
    setError('');
    setExpandedDay(null);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isPlainText = ext === 'txt' || ext === 'md';

    if (isPlainText) {
      // Read directly in browser
      const reader = new FileReader();
      reader.onload = ev => {
        const content = ev.target?.result as string;
        setText(content.slice(0, 30000));
        if (textareaRef.current) textareaRef.current.focus();
      };
      reader.readAsText(file);
      return;
    }

    // Send to server-side extraction API (PDF, PPTX, DOCX…)
    setStage('extracting');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch('/api/ai/extract-file', { method: 'POST', body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || `Could not read file (HTTP ${resp.status})`);
        setStage('error');
        return;
      }
      setText(data.text ?? '');
      setStage('input');
      if (textareaRef.current) textareaRef.current.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStage('error');
    }
  };

  const totalActivities = parsed?.days.reduce((s, d) => s + d.activities.length, 0) ?? 0;

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <div className="title-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <h2>{mode === 'generate' ? 'AI Plan Generator' : 'Import Itinerary'}</h2>
              <p>{mode === 'generate' ? 'Describe your trip and AI will build a complete plan' : 'Paste your trip description and AI will build the plan'}</p>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* ── NOT CONFIGURED ─────────────────────────────── */}
          {!aiConfigured && (
            <div className="not-configured">
              <AlertCircle size={20} />
              <div>
                <strong>AI not configured</strong>
                <p>Go to Settings → Intelligence to connect your AI provider first.</p>
              </div>
            </div>
          )}

          {/* ── INPUT STAGE ────────────────────────────────── */}
          {(stage === 'input' || stage === 'error') && (
            <>
              <div className="input-area">
                {mode !== 'generate' && (
                <div className="input-toolbar">
                  <span className="input-label">
                    <FileText size={14} />
                    Paste your itinerary or upload a document
                  </span>
                  <div className="upload-btns">
                    <label className="upload-btn">
                      <Upload size={13} />
                      .txt / .md
                      <input type="file" accept=".txt,.md" onChange={handleFileUpload} hidden />
                    </label>
                    <label className="upload-btn upload-btn-rich">
                      <FileUp size={13} />
                      PDF / PPT / Word
                      <input
                        type="file"
                        accept=".pdf,.pptx,.ppt,.docx,.doc"
                        onChange={handleFileUpload}
                        hidden
                      />
                    </label>
                  </div>
                </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => { setText(e.target.value); if (stage === 'error') setStage('input'); }}
                  placeholder={mode === 'generate'
                    ? `Describe what you want, e.g. "A 3-day beach trip to Bali with morning yoga, afternoon sightseeing, and sunset cocktail dinners. Keep it relaxed and budget-friendly."`
                    : `Paste your full trip itinerary here — including dates, destinations, activities, hotels, and any details you have.

Example:
Day 1 - April 4, Ha Noi
Arrival at Noi Bai Airport, transfer to hotel.
Afternoon: Visit Hoan Kiem Lake and Ngoc Son Temple...`}
                  rows={12}
                />
                <div className="char-count">{text.length.toLocaleString()} characters</div>
              </div>

              {stage === 'error' && (
                <div className="error-banner">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </>
          )}

          {/* ── EXTRACTING STAGE ───────────────────────────── */}
          {stage === 'extracting' && (
            <div className="parsing-state">
              <div className="parsing-spinner">
                <Loader2 size={32} className="spin" />
              </div>
              <p className="parsing-title">Reading your file…</p>
              <p className="parsing-desc">Extracting text from the document. This only takes a moment.</p>
            </div>
          )}

          {/* ── PARSING STAGE ──────────────────────────────── */}
          {stage === 'parsing' && (
            <div className="parsing-state">
              <div className="parsing-spinner">
                <Loader2 size={32} className="spin" />
              </div>
              <p className="parsing-title">Analysing your itinerary…</p>
              <p className="parsing-desc">AI is reading and structuring your trip. This takes 10–30 seconds.</p>
            </div>
          )}

          {/* ── PREVIEW STAGE ──────────────────────────────── */}
          {(stage === 'preview' || stage === 'creating') && parsed && (
            <div className="preview">
              {/* Trip summary */}
              <div className="trip-summary">
                <div className="trip-meta">
                  <h3 className="trip-title">{parsed.title}</h3>
                  {parsed.description && <p className="trip-desc">{parsed.description}</p>}
                  <div className="trip-chips">
                    {parsed.destination && (
                      <span className="chip">
                        <MapPin size={12} />
                        {parsed.destination}
                      </span>
                    )}
                    <span className="chip">
                      <Calendar size={12} />
                      {parsed.startDate} → {parsed.endDate}
                    </span>
                    <span className="chip">
                      <Sparkles size={12} />
                      {parsed.days.length} days · {totalActivities} activities
                    </span>
                  </div>
                </div>
              </div>

              {/* Day accordion */}
              <div className="days-list">
                {parsed.days.map((day, i) => (
                  <div key={day.id} className="day-card">
                    <button
                      className="day-header"
                      onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                    >
                      <div className="day-left">
                        <span className="day-num">Day {day.dayNumber}</span>
                        <span className="day-title">{day.title || day.date}</span>
                        <span className="day-count">{day.activities.length} activities</span>
                      </div>
                      {expandedDay === i ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {expandedDay === i && (
                      <div className="day-activities">
                        {day.activities.map((act) => (
                          <div key={act.id} className="activity-row">
                            <span className="act-icon">{ACTIVITY_ICONS[act.type]}</span>
                            <div className="act-info">
                              <span className="act-title">{act.title}</span>
                              {act.location && <span className="act-loc">{act.location}</span>}
                            </div>
                            <div className="act-time">
                              <span>{act.startTime}</span>
                              <span className="act-dur">{act.duration}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Creating state */}
          {stage === 'creating' && (
            <div className="creating-overlay">
              <Loader2 size={24} className="spin" />
              <span>Saving your plan…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {(stage === 'input' || stage === 'error') && (
            <>
              <button className="btn-ghost" onClick={handleClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleParse}
                disabled={!text.trim() || !aiConfigured}
              >
                <Sparkles size={16} />
                Parse with AI
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button className="btn-ghost" onClick={() => { setStage('input'); setParsed(null); }}>
                ← Edit Text
              </button>
              <button className="btn-primary" onClick={handleCreate}>
                <CheckCircle2 size={16} />
                Create Plan ({parsed?.days.length} days)
              </button>
            </>
          )}

          {stage === 'parsing' && (
            <button className="btn-ghost" onClick={handleClose}>Cancel</button>
          )}

          {stage === 'extracting' && (
            <button className="btn-ghost" onClick={() => setStage('input')}>Cancel</button>
          )}
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
          touch-action: none;
        }

        .modal {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 100%;
          max-width: 640px;
          /* dvh shrinks with iOS keyboard; safe-area-inset-top keeps the modal
             clear of the notch on mobile fullscreen. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 24px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.25);
        }

        /* Header */
        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .modal-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .title-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 20%, var(--card)),
            color-mix(in srgb, var(--primary) 8%, var(--card))
          );
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          flex-shrink: 0;
        }
        .modal-title h2 {
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 3px;
        }
        .modal-title p {
          font-size: 12px;
          color: var(--muted-foreground);
          margin: 0;
        }
        .close-btn {
          padding: 6px;
          border: none;
          background: none;
          color: var(--muted-foreground);
          cursor: pointer;
          border-radius: 8px;
          display: flex;
          transition: all 0.15s;
        }
        .close-btn:hover { background: var(--muted); color: var(--foreground); }

        /* Body */
        .modal-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 20px 24px;
          position: relative;
        }

        /* Not configured */
        .not-configured {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 16px;
          background: color-mix(in srgb, #f59e0b 10%, var(--card));
          border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
          border-radius: 10px;
          margin-bottom: 16px;
          color: #d97706;
          font-size: 13px;
        }
        .not-configured strong { display: block; font-weight: 700; margin-bottom: 2px; }
        .not-configured p { margin: 0; color: var(--muted-foreground); }

        /* Input area */
        .input-area {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .input-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted-foreground);
        }
        .upload-btns {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid var(--border);
          border-radius: 7px;
          font-size: 12px;
          font-weight: 500;
          color: var(--foreground);
          background: var(--background);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .upload-btn:hover { border-color: var(--primary); }

        .upload-btn-rich {
          border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 6%, var(--background));
        }
        .upload-btn-rich:hover {
          background: color-mix(in srgb, var(--primary) 12%, var(--background));
        }

        textarea {
          width: 100%;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--background);
          color: var(--foreground);
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
          min-height: 220px;
          font-family: inherit;
          transition: border-color 0.15s;
        }
        textarea:focus { outline: none; border-color: var(--primary); }
        textarea::placeholder { color: color-mix(in srgb, var(--muted-foreground) 60%, transparent); }

        .char-count {
          font-size: 11px;
          color: var(--muted-foreground);
          text-align: right;
        }

        /* Error */
        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 12px;
          padding: 12px 14px;
          background: color-mix(in srgb, #ef4444 8%, var(--card));
          border: 1px solid color-mix(in srgb, #ef4444 22%, transparent);
          border-radius: 10px;
          font-size: 13px;
          color: #dc2626;
          line-height: 1.4;
        }

        /* Parsing state */
        .parsing-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          gap: 12px;
        }
        .parsing-spinner {
          color: var(--primary);
          margin-bottom: 8px;
        }
        .parsing-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0;
        }
        .parsing-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
          max-width: 340px;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Preview */
        .preview { display: flex; flex-direction: column; gap: 16px; }

        .trip-summary {
          padding: 16px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 8%, var(--card)),
            color-mix(in srgb, var(--primary) 3%, var(--card))
          );
          border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
          border-radius: 14px;
        }
        .trip-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 4px;
        }
        .trip-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0 0 12px;
          line-height: 1.4;
        }
        .trip-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          color: var(--foreground);
        }

        /* Days list */
        .days-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .day-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--card);
        }

        .day-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          width: 100%;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          color: var(--foreground);
          transition: background 0.12s;
          gap: 10px;
        }
        .day-header:hover { background: var(--muted); }

        .day-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .day-num {
          font-size: 11px;
          font-weight: 700;
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 12%, var(--card));
          padding: 2px 8px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .day-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .day-count {
          font-size: 11px;
          color: var(--muted-foreground);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .day-activities {
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }

        .activity-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.1s;
        }
        .activity-row:last-child { border-bottom: none; }
        .activity-row:hover { background: var(--muted); }

        .act-icon { font-size: 16px; flex-shrink: 0; }
        .act-info { flex: 1; min-width: 0; }
        .act-title {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .act-loc {
          display: block;
          font-size: 11px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .act-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
          gap: 1px;
        }
        .act-time span {
          font-size: 12px;
          font-weight: 600;
          color: var(--foreground);
        }
        .act-dur {
          font-size: 11px;
          color: var(--muted-foreground) !important;
          font-weight: 400 !important;
        }

        /* Creating overlay */
        .creating-overlay {
          position: absolute;
          inset: 0;
          background: color-mix(in srgb, var(--card) 85%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
          border-radius: 0 0 20px 20px;
        }

        /* Footer — flex-none + safe-area padding so Import/Create is always
           reachable, even with 14-day itineraries in the preview. */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border);
          background: var(--card);
          flex-shrink: 0;
        }

        .btn-ghost {
          padding: 9px 18px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: var(--foreground);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-ghost:hover { background: var(--muted); }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        @media (max-width: 520px) {
          .overlay { padding: 12px; }
          .modal { max-height: calc(100dvh - env(safe-area-inset-top, 0px)); border-radius: 16px; }
          .modal-header, .modal-body, .modal-footer { padding-left: 16px; padding-right: 16px; }
          .trip-chips { flex-direction: column; }
          textarea { font-size: 16px; min-height: 150px; }
          .input-toolbar { flex-direction: column; align-items: flex-start; gap: 8px; }
          .upload-btns { width: 100%; }
          .upload-btn { flex: 1; justify-content: center; }
          .activity-row { gap: 6px; padding: 9px 12px; }
          .act-time span { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}

export default ImportItineraryModal;
