'use client';

import { useState, useEffect } from 'react';
import { ChecklistTemplate, ChecklistTemplateCategory, AIChecklistGenerationResult } from '@/lib/types';
import { Search, X, Sparkles, LayoutTemplate } from 'lucide-react';

const CATEGORIES: { value: ChecklistTemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'travel', label: 'Travel' },
  { value: 'event', label: 'Event' },
  { value: 'work', label: 'Work' },
  { value: 'home', label: 'Home' },
  { value: 'health', label: 'Health' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string, templateTitle: string) => void;
}

export function TemplateBrowser({ isOpen, onClose, onSelect }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ChecklistTemplateCategory | 'all'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category !== 'all') params.set('category', category);
    setIsLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- kicking off an async fetch requires setting loading state
    fetch(`/api/checklists/templates?${params.toString()}`)
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .finally(() => setIsLoading(false));
  }, [isOpen, query, category]);

  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="browser-sheet" onClick={e => e.stopPropagation()}>
        <div className="browser-header">
          <h2>Browse Templates</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="browser-search">
          <Search size={16} />
          <input
            placeholder="Search templates..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && <button onClick={() => setQuery('')}><X size={14} /></button>}
        </div>

        <div className="category-chips">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`cat-chip${category === cat.value ? ' active' : ''}`}
              onClick={() => setCategory(cat.value as ChecklistTemplateCategory | 'all')}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="templates-grid">
          {isLoading ? (
            [1, 2, 3, 4].map(i => <div key={i} className="skeleton" />)
          ) : templates.length === 0 ? (
            <div className="no-results">
              <LayoutTemplate size={32} />
              <p>No templates found</p>
              <span>Be the first to publish one!</span>
            </div>
          ) : (
            templates.map(tpl => (
              <button
                key={tpl.id}
                className="template-card"
                onClick={() => onSelect(tpl.id, tpl.title)}
              >
                <div className="tpl-header">
                  <span className="cat-badge">{tpl.category}</span>
                  <span className="item-count">{tpl.itemCount} items</span>
                </div>
                <h4>{tpl.title}</h4>
                {tpl.description && <p>{tpl.description}</p>}
                <div className="tpl-footer">
                  <span className="author">by {tpl.authorName || 'Community'}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <style jsx>{`
          .overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 200; display: flex; align-items: flex-end;
          }
          .browser-sheet {
            width: 100%;
            /* dvh so long grids don't extend into the notch/home indicator;
               safe-area on top keeps the sheet clear of the notch. */
            max-height: calc(100dvh - env(safe-area-inset-top, 0px));
            background: var(--background, white);
            border-radius: 20px 20px 0 0; overflow: hidden;
            display: flex; flex-direction: column;
          }
          .browser-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid var(--border);
          }
          .browser-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
          .close-btn { background: none; border: none; cursor: pointer; color: var(--muted-foreground); padding: 4px; }
          .browser-search {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 16px; border-bottom: 1px solid var(--border);
            background: var(--muted, #f9fafb);
          }
          .browser-search input {
            flex: 1; border: none; background: none; font-size: 14px;
            color: var(--foreground); outline: none;
          }
          .browser-search button { background: none; border: none; cursor: pointer; color: var(--muted-foreground); }
          .category-chips {
            display: flex; gap: 6px; padding: 10px 16px;
            overflow-x: auto; border-bottom: 1px solid var(--border);
          }
          .cat-chip {
            padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border);
            background: var(--background, white); font-size: 12px; font-weight: 500;
            cursor: pointer; white-space: nowrap; color: var(--foreground);
          }
          .cat-chip.active { background: var(--primary, #6366f1); color: white; border-color: var(--primary); }
          .templates-grid {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            /* Safe-area bottom padding so the last row of cards clears the
               iOS home indicator. */
            padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
            display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;
          }
          .skeleton {
            height: 120px; border-radius: 12px; background: var(--muted, #f3f4f6);
            animation: pulse 1.5s ease-in-out infinite;
          }
          @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
          .no-results {
            grid-column: 1/-1; display: flex; flex-direction: column;
            align-items: center; gap: 8px; padding: 40px; color: var(--muted-foreground); text-align: center;
          }
          .template-card {
            background: var(--card, white); border: 1px solid var(--border); border-radius: 12px;
            padding: 14px; cursor: pointer; text-align: left;
            display: flex; flex-direction: column; gap: 6px;
            transition: all 0.15s;
          }
          .template-card:hover { border-color: var(--primary, #6366f1); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .tpl-header { display: flex; align-items: center; justify-content: space-between; }
          .cat-badge {
            font-size: 10px; font-weight: 600; padding: 2px 6px;
            border-radius: 6px; background: var(--muted, #f3f4f6); color: var(--muted-foreground);
            text-transform: uppercase;
          }
          .item-count { font-size: 11px; color: var(--muted-foreground); }
          .template-card h4 { font-size: 14px; font-weight: 600; color: var(--foreground); margin: 0; }
          .template-card p {
            font-size: 12px; color: var(--muted-foreground); margin: 0;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          }
          .tpl-footer { margin-top: 4px; }
          .author { font-size: 11px; color: var(--muted-foreground); }
        `}</style>
      </div>
    </div>
  );
}

// ─── AI Checklist Modal ───────────────────────────────────────────────────────

interface AIChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (result: AIChecklistGenerationResult) => void;
}

export function AIChecklistModal({ isOpen, onClose, onGenerated }: AIChecklistModalProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EXAMPLES = [
    'Weekend camping trip for 4 adults',
    'Birthday party for 20 people',
    'Moving to a new apartment',
    'Job interview preparation',
  ];

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to generate checklist.');
      } else {
        onGenerated(data as AIChecklistGenerationResult);
        setDescription('');
      }
    } catch {
      setError('Failed to reach AI service. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-sheet" onClick={e => e.stopPropagation()}>
        <div className="ai-header">
          <div className="ai-title-row">
            <Sparkles size={18} color="#7c3aed" />
            <h3>AI Checklist Generator</h3>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="ai-body">
          <label className="field-label">Describe your occasion or task</label>
          <textarea
            className="desc-textarea"
            placeholder="e.g. Weekend camping trip for 4 adults in the mountains..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            disabled={isGenerating}
          />
          <div className="char-count">{description.length}/500</div>

          <div className="examples-row">
            {EXAMPLES.map(ex => (
              <button key={ex} className="example-chip" onClick={() => setDescription(ex)}>
                {ex}
              </button>
            ))}
          </div>

          {error && <div className="error-msg">{error}</div>}
        </div>

        <div className="ai-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate
              </>
            )}
          </button>
        </div>

        <style jsx>{`
          .ai-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 200; display: flex; align-items: flex-end;
          }
          .ai-sheet {
            width: 100%; background: var(--background, white);
            border-radius: 20px 20px 0 0; overflow: hidden;
          }
          .ai-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid var(--border);
          }
          .ai-title-row { display: flex; align-items: center; gap: 8px; }
          .ai-title-row h3 { font-size: 17px; font-weight: 700; margin: 0; }
          .close-btn { background: none; border: none; cursor: pointer; color: var(--muted-foreground); }
          .ai-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
          .field-label { font-size: 13px; font-weight: 600; color: var(--foreground); }
          .desc-textarea {
            width: 100%; border: 1px solid var(--border); border-radius: 10px;
            padding: 10px 12px; font-size: 14px; resize: vertical;
            background: var(--background); color: var(--foreground); outline: none;
            font-family: inherit;
          }
          .desc-textarea:focus { border-color: var(--primary, #6366f1); }
          .char-count { font-size: 11px; color: var(--muted-foreground); text-align: right; margin-top: -6px; }
          .examples-row { display: flex; flex-wrap: wrap; gap: 6px; }
          .example-chip {
            padding: 4px 10px; border-radius: 99px; border: 1px solid var(--border);
            background: var(--muted, #f9fafb); font-size: 12px; cursor: pointer; color: var(--foreground);
          }
          .example-chip:hover { border-color: var(--primary); color: var(--primary); }
          .error-msg {
            padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca;
            border-radius: 8px; font-size: 13px; color: #dc2626;
          }
          .ai-footer {
            display: flex; gap: 10px; justify-content: flex-end;
            padding: 12px 20px; border-top: 1px solid var(--border);
          }
          .cancel-btn {
            padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border);
            background: transparent; cursor: pointer; font-size: 14px; color: var(--foreground);
          }
          .generate-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 10px 20px; border-radius: 10px; border: none;
            background: linear-gradient(135deg, #6366f1, #7c3aed);
            color: white; cursor: pointer; font-size: 14px; font-weight: 600;
          }
          .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .spinner {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
            animation: spin 0.7s linear infinite; display: inline-block;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
