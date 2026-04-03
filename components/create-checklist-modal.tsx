'use client';

import React, { useState, useEffect } from 'react';
import { AIChecklistGenerationResult } from '@/lib/types';
import { loadAISettings } from '@/lib/ai-settings';
import {
  Plus, X, Sparkles, LayoutTemplate, PenLine, Check,
  Search, ArrowLeft,
} from 'lucide-react';

interface CreateChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (checklistId: string) => void;
  defaultPlanId?: string;
  initialMode?: 'manual' | 'ai' | 'template';
}

type CreationMode = 'manual' | 'ai' | 'template';

// Which screen is shown inside the single sheet
type View =
  | 'pick'        // step 1: choose mode
  | 'manual'      // manual form
  | 'ai'          // AI description input
  | 'templates'   // template browser
  | 'preview';    // review items before saving

interface PreviewItem { title: string; groupName: string; included: boolean; }

const EXAMPLES = [
  'Weekend camping trip for 4 adults',
  'Birthday party for 20 people',
  'Moving to a new apartment',
  'Job interview preparation',
];

const TEMPLATE_CATEGORIES = [
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

export default function CreateChecklistModal({
  isOpen, onClose, onCreated, defaultPlanId, initialMode,
}: CreateChecklistModalProps) {
  // Navigation
  const [view, setView] = useState<View>('pick');
  const [mode, setMode] = useState<CreationMode>('manual');

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [planId, setPlanId] = useState(defaultPlanId || '');
  const [plans, setPlans] = useState<{ id: string; title: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI view state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Template view state
  const [templates, setTemplates] = useState<{ id: string; title: string; category: string; description?: string; authorName?: string; itemCount?: number }[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Preview state
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  // On open: set initial view based on mode prop
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => setPlans(d.plans?.map((p: { id?: string; _id?: string; title: string }) => ({ id: p._id || p.id, title: p.title })) || []));

    if (initialMode === 'ai') { setMode('ai'); setView('ai'); }
    else if (initialMode === 'template') { setMode('template'); setView('templates'); }
    else if (initialMode === 'manual') { setMode('manual'); setView('manual'); }
    else { setView('pick'); }
  }, [isOpen, initialMode]);

  // Load templates when templates view is shown
  useEffect(() => {
    if (view !== 'templates') return;
    const params = new URLSearchParams();
    if (templateQuery) params.set('q', templateQuery);
    if (templateCategory !== 'all') params.set('category', templateCategory);
    setTemplatesLoading(true);
    fetch(`/api/checklists/templates?${params}`)
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .finally(() => setTemplatesLoading(false));
  }, [view, templateQuery, templateCategory]);

  const reset = () => {
    setView('pick'); setMode('manual');
    setTitle(''); setDescription(''); setDueDate(''); setDueTime('');
    setPlanId(defaultPlanId || ''); setAiPrompt(''); setAiError('');
    setTemplateQuery(''); setTemplateCategory('all'); setSelectedTemplateId('');
    setPreviewItems([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleModeSelect = (m: CreationMode) => {
    setMode(m);
    setView(m === 'manual' ? 'manual' : m === 'ai' ? 'ai' : 'templates');
  };

  // ── AI generate ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    const settings = loadAISettings();
    if (!settings?.clientId) {
      setAiError('AI is not configured. Go to Settings → Intelligence to set up SAP AI Core.');
      return;
    }
    setIsGenerating(true); setAiError('');
    try {
      const res = await fetch('/api/ai/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt.trim(), settings }),
      });
      const data: AIChecklistGenerationResult & { error?: string } = await res.json();
      if (data.error) { setAiError(data.error); return; }
      setTitle(data.title || '');
      setPreviewItems(data.groups.flatMap(g => g.items.map(item => ({ title: item, groupName: g.groupName, included: true }))));
      setView('preview');
    } catch {
      setAiError('Failed to reach AI service. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Template select ────────────────────────────────────
  const handleTemplateSelect = async (tplId: string, tplTitle: string) => {
    setSelectedTemplateId(tplId);
    setTitle(tplTitle);
    const res = await fetch(`/api/checklists/templates?id=${tplId}`);
    const data = await res.json();
    if (data.template?.items) {
      setPreviewItems(data.template.items.map((i: { title: string; groupName?: string }) => ({
        title: i.title, groupName: i.groupName || '', included: true,
      })));
    }
    setView('preview');
  };

  // ── Create ─────────────────────────────────────────────
  const handleCreateManual = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description, dueDate: dueDate || null, dueTime: dueTime || null, planId: planId || null }),
      });
      const data = await res.json();
      if (data.checklist) { reset(); onCreated(data.checklist.id); }
    } finally { setIsSubmitting(false); }
  };

  const handleCreateFromPreview = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const included = previewItems.filter(i => i.included);
      let res;
      if (mode === 'template' && selectedTemplateId) {
        res = await fetch('/api/checklists/from-template', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: selectedTemplateId, title: title.trim(), planId: planId || null }),
        });
      } else {
        res = await fetch('/api/checklists', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), description,
            dueDate: dueDate || null, dueTime: dueTime || null, planId: planId || null,
            items: included.map(i => ({ title: i.title, groupName: i.groupName })),
          }),
        });
      }
      const data = await res.json();
      if (data.checklist) { reset(); onCreated(data.checklist.id); }
    } finally { setIsSubmitting(false); }
  };

  const toggleItem = (idx: number) =>
    setPreviewItems(prev => prev.map((item, i) => i === idx ? { ...item, included: !item.included } : item));

  // ── Group preview items ────────────────────────────────
  const groups = previewItems.reduce((acc, item) => {
    const k = item.groupName || 'Items';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, PreviewItem[]>);

  const globalIdx = (groupName: string, localIdx: number) => {
    let offset = 0;
    for (const [k, items] of Object.entries(groups)) {
      if (k === groupName) return offset + localIdx;
      offset += items.length;
    }
    return localIdx;
  };

  if (!isOpen) return null;

  const TITLES: Record<View, string> = {
    pick: 'Create Checklist',
    manual: 'New Checklist',
    ai: 'AI Generate',
    templates: 'Browse Templates',
    preview: mode === 'ai' ? 'Review AI Checklist' : 'Review Template',
  };

  const canGoBack = view !== 'pick' && !initialMode;
  const backView: Record<View, View> = { pick: 'pick', manual: 'pick', ai: 'pick', templates: 'pick', preview: mode === 'ai' ? 'ai' : 'templates' };

  return (
    <div className="overlay" onClick={handleClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="header">
          {canGoBack ? (
            <button className="back-btn" onClick={() => setView(backView[view])}>
              <ArrowLeft size={18} />
            </button>
          ) : <div className="header-spacer" />}
          <h2>{TITLES[view]}</h2>
          <button className="close-btn" onClick={handleClose}><X size={18} /></button>
        </div>

        {/* ── View: Pick mode ───────────────────── */}
        {view === 'pick' && (
          <div className="mode-grid">
            <button className="mode-card" onClick={() => handleModeSelect('manual')}>
              <div className="mode-icon manual-icon"><PenLine size={22} /></div>
              <div className="mode-text">
                <h3>Manual</h3>
                <p>Start with a blank checklist and add items yourself</p>
              </div>
            </button>
            <button className="mode-card mode-ai" onClick={() => handleModeSelect('ai')}>
              <div className="mode-icon ai-icon"><Sparkles size={22} /></div>
              <div className="mode-text">
                <h3>AI Generate</h3>
                <p>Describe your task and AI will create a grouped checklist</p>
              </div>
            </button>
            <button className="mode-card mode-template" onClick={() => handleModeSelect('template')}>
              <div className="mode-icon tpl-icon"><LayoutTemplate size={22} /></div>
              <div className="mode-text">
                <h3>From Template</h3>
                <p>Pick from community-shared templates and customize</p>
              </div>
            </button>
          </div>
        )}

        {/* ── View: Manual form ─────────────────── */}
        {view === 'manual' && (
          <>
            <div className="form-body">
              <label className="field-label">Title *</label>
              <input className="field-input" placeholder="e.g. Packing list" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              <label className="field-label">Description</label>
              <input className="field-input" placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
              <div className="row-fields">
                <div className="field-group">
                  <label className="field-label">Due Date</label>
                  <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Time</label>
                  <input className="field-input" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
                </div>
              </div>
              {plans.length > 0 && (
                <>
                  <label className="field-label">Link to Plan (optional)</label>
                  <select className="field-input" value={planId} onChange={e => setPlanId(e.target.value)}>
                    <option value="">None</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </>
              )}
            </div>
            <div className="footer">
              <button className="cancel-btn" onClick={handleClose}>Cancel</button>
              <button className="create-btn" onClick={handleCreateManual} disabled={!title.trim() || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Checklist'}
              </button>
            </div>
          </>
        )}

        {/* ── View: AI input ────────────────────── */}
        {view === 'ai' && (
          <>
            <div className="form-body">
              <label className="field-label">Describe your occasion or task</label>
              <textarea
                className="field-textarea"
                placeholder="e.g. Weekend camping trip for 4 adults in the mountains..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={4}
                maxLength={500}
                disabled={isGenerating}
              />
              <div className="char-count">{aiPrompt.length}/500</div>
              <div className="examples-row">
                {EXAMPLES.map(ex => (
                  <button key={ex} className="example-chip" onClick={() => setAiPrompt(ex)}>{ex}</button>
                ))}
              </div>
              {aiError && <div className="error-msg">{aiError}</div>}
            </div>
            <div className="footer">
              <button className="cancel-btn" onClick={handleClose}>Cancel</button>
              <button className="create-btn ai-btn" onClick={handleGenerate} disabled={!aiPrompt.trim() || isGenerating}>
                {isGenerating ? <><span className="spinner" />Generating…</> : <><Sparkles size={15} />Generate</>}
              </button>
            </div>
          </>
        )}

        {/* ── View: Template browser ────────────── */}
        {view === 'templates' && (
          <>
            <div className="search-bar">
              <Search size={16} />
              <input
                placeholder="Search templates..."
                value={templateQuery}
                onChange={e => setTemplateQuery(e.target.value)}
              />
              {templateQuery && <button className="clear-btn" onClick={() => setTemplateQuery('')}><X size={14} /></button>}
            </div>
            <div className="cat-chips-row">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`cat-chip${templateCategory === cat.value ? ' active' : ''}`}
                  onClick={() => setTemplateCategory(cat.value)}
                >{cat.label}</button>
              ))}
            </div>
            <div className="templates-body">
              {templatesLoading ? (
                [1, 2, 3].map(i => <div key={i} className="skeleton" />)
              ) : templates.length === 0 ? (
                <div className="no-results">
                  <LayoutTemplate size={28} />
                  <p>No templates found</p>
                  <span>Be the first to publish one!</span>
                </div>
              ) : templates.map(tpl => (
                <button key={tpl.id} className="tpl-card" onClick={() => handleTemplateSelect(tpl.id, tpl.title)}>
                  <div className="tpl-row">
                    <span className="tpl-cat">{tpl.category}</span>
                    {tpl.itemCount != null && <span className="tpl-count">{tpl.itemCount} items</span>}
                  </div>
                  <h4>{tpl.title}</h4>
                  {tpl.description && <p>{tpl.description}</p>}
                  {tpl.authorName && <span className="tpl-author">by {tpl.authorName}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── View: Preview ─────────────────────── */}
        {view === 'preview' && (
          <>
            <div className="form-body">
              <label className="field-label">Title</label>
              <input className="field-input" value={title} onChange={e => setTitle(e.target.value)} />
              <div className="row-fields">
                <div className="field-group">
                  <label className="field-label">Due Date</label>
                  <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Time</label>
                  <input className="field-input" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
                </div>
              </div>
              {plans.length > 0 && (
                <>
                  <label className="field-label">Link to Plan (optional)</label>
                  <select className="field-input" value={planId} onChange={e => setPlanId(e.target.value)}>
                    <option value="">None</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </>
              )}
              <div className="preview-header">
                <label className="field-label">Items</label>
                <span className="item-count">{previewItems.filter(i => i.included).length} selected</span>
              </div>
              <div className="preview-list">
                {Object.entries(groups).map(([groupName, items]) => (
                  <div key={groupName}>
                    {groupName !== 'Items' && <div className="group-name">{groupName}</div>}
                    {items.map((item, localIdx) => {
                      const idx = globalIdx(groupName, localIdx);
                      return (
                        <div key={idx} className={`preview-item${item.included ? '' : ' excluded'}`}>
                          <button className="item-toggle" onClick={() => toggleItem(idx)}>
                            {item.included ? <Check size={12} strokeWidth={3} /> : null}
                          </button>
                          <span>{item.title}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="footer">
              <button className="cancel-btn" onClick={handleClose}>Cancel</button>
              <button className="create-btn" onClick={handleCreateFromPreview}
                disabled={!title.trim() || previewItems.filter(i => i.included).length === 0 || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Save Checklist'}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed; inset: 0; z-index: 150;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: flex-end;
        }
        .sheet {
          width: 100%; max-height: 92vh;
          background: var(--background);
          border-radius: 20px 20px 0 0;
          display: flex; flex-direction: column;
          overflow: hidden;
        }

        /* Header */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .header h2 { font-size: 17px; font-weight: 700; margin: 0; flex: 1; text-align: center; }
        .back-btn, .close-btn {
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer; color: var(--muted-foreground);
          border-radius: 8px; flex-shrink: 0;
        }
        .back-btn:hover, .close-btn:hover { background: var(--muted); color: var(--foreground); }
        .header-spacer { width: 36px; flex-shrink: 0; }

        /* Mode picker */
        .mode-grid { display: flex; flex-direction: column; gap: 10px; padding: 16px; overflow-y: auto; }
        .mode-card {
          display: flex; align-items: center; gap: 14px;
          padding: 16px; border: 1.5px solid var(--border); border-radius: 14px;
          background: var(--background); cursor: pointer; text-align: left; transition: all 0.15s;
        }
        .mode-card:hover { border-color: var(--primary); }
        .mode-ai { border-color: color-mix(in srgb, #a78bfa 50%, var(--border)); background: color-mix(in srgb, #a78bfa 10%, var(--card)); }
        .mode-template { border-color: color-mix(in srgb, #34d399 50%, var(--border)); background: color-mix(in srgb, #34d399 10%, var(--card)); }
        .mode-icon {
          width: 46px; height: 46px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .manual-icon { background: var(--muted); color: var(--foreground); }
        .ai-icon { background: color-mix(in srgb, #a78bfa 25%, var(--card)); color: #7c3aed; }
        .tpl-icon { background: color-mix(in srgb, #34d399 25%, var(--card)); color: #059669; }
        .mode-text { flex: 1; min-width: 0; }
        .mode-card h3 { font-size: 15px; font-weight: 700; margin: 0 0 3px; color: var(--foreground); }
        .mode-card p { font-size: 13px; color: var(--muted-foreground); margin: 0; }

        /* Form body */
        .form-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .field-label { font-size: 13px; font-weight: 600; color: var(--foreground); }
        .field-input {
          width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 10px;
          font-size: 15px; background: var(--background); color: var(--foreground);
          outline: none; min-height: 44px; box-sizing: border-box; -webkit-appearance: none;
        }
        .field-input:focus { border-color: var(--primary); }
        .field-textarea {
          width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 10px;
          font-size: 15px; background: var(--background); color: var(--foreground);
          outline: none; resize: none; font-family: inherit; box-sizing: border-box;
        }
        .field-textarea:focus { border-color: var(--primary); }
        .row-fields { display: flex; gap: 10px; }
        .field-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }

        /* AI view */
        .char-count { font-size: 11px; color: var(--muted-foreground); text-align: right; margin-top: -4px; }
        .examples-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .example-chip {
          padding: 6px 12px; border-radius: 99px; border: 1px solid var(--border);
          background: var(--muted); font-size: 12px; cursor: pointer; color: var(--foreground);
        }
        .example-chip:hover { border-color: var(--primary); color: var(--primary); }
        .error-msg {
          padding: 10px 14px; background: color-mix(in srgb, #ef4444 10%, var(--card));
          border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
          border-radius: 8px; font-size: 13px; color: #dc2626;
        }

        /* Template browser */
        .search-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-bottom: 1px solid var(--border);
          background: var(--muted); flex-shrink: 0;
        }
        .search-bar input {
          flex: 1; border: none; background: none; font-size: 15px;
          color: var(--foreground); outline: none;
        }
        .clear-btn { background: none; border: none; cursor: pointer; color: var(--muted-foreground); display: flex; }
        .cat-chips-row {
          display: flex; gap: 6px; padding: 10px 16px;
          overflow-x: auto; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .cat-chip {
          padding: 5px 14px; border-radius: 99px; border: 1px solid var(--border);
          background: var(--background); font-size: 12px; font-weight: 500;
          cursor: pointer; white-space: nowrap; color: var(--foreground); flex-shrink: 0;
        }
        .cat-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
        .templates-body {
          flex: 1; overflow-y: auto; padding: 14px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .skeleton { height: 80px; border-radius: 12px; background: var(--muted); animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        .no-results {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 40px; color: var(--muted-foreground); text-align: center;
        }
        .no-results p { font-size: 15px; font-weight: 500; color: var(--foreground); margin: 0; }
        .no-results span { font-size: 13px; }
        .tpl-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          padding: 14px; cursor: pointer; text-align: left;
          display: flex; flex-direction: column; gap: 4px; transition: all 0.15s; width: 100%;
        }
        .tpl-card:hover { border-color: var(--primary); }
        .tpl-row { display: flex; align-items: center; justify-content: space-between; }
        .tpl-cat {
          font-size: 10px; font-weight: 600; padding: 2px 7px;
          border-radius: 6px; background: var(--muted); color: var(--muted-foreground); text-transform: uppercase;
        }
        .tpl-count { font-size: 11px; color: var(--muted-foreground); }
        .tpl-card h4 { font-size: 14px; font-weight: 600; color: var(--foreground); margin: 0; }
        .tpl-card p { font-size: 12px; color: var(--muted-foreground); margin: 0; }
        .tpl-author { font-size: 11px; color: var(--muted-foreground); }

        /* Preview */
        .preview-header { display: flex; align-items: center; justify-content: space-between; }
        .item-count { font-size: 12px; color: var(--muted-foreground); }
        .preview-list {
          border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
        }
        .group-name {
          padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--muted-foreground); background: var(--muted);
          border-bottom: 1px solid var(--border);
        }
        .preview-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-bottom: 1px solid var(--border);
          font-size: 13px; color: var(--foreground);
        }
        .preview-item:last-child { border-bottom: none; }
        .preview-item.excluded { opacity: 0.4; text-decoration: line-through; }
        .item-toggle {
          width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid var(--primary); background: var(--primary);
          cursor: pointer; display: flex; align-items: center; justify-content: center; color: white;
        }
        .excluded .item-toggle { background: transparent; border-color: var(--border); }

        /* Footer */
        .footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0;
        }
        .cancel-btn {
          padding: 11px 20px; border-radius: 10px; border: 1px solid var(--border);
          background: transparent; cursor: pointer; font-size: 14px; color: var(--foreground);
          min-height: 44px;
        }
        .create-btn {
          padding: 11px 24px; border-radius: 10px; border: none;
          background: var(--primary); color: white;
          cursor: pointer; font-size: 14px; font-weight: 600; min-height: 44px;
          display: flex; align-items: center; gap: 6px;
        }
        .create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ai-btn { background: linear-gradient(135deg, #6366f1, #7c3aed); }
        .spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          animation: spin2 0.7s linear infinite; display: inline-block;
        }
        @keyframes spin2 { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
