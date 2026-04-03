'use client';

import React, { useState, useEffect } from 'react';
import { AIChecklistGenerationResult, ChecklistTemplateCategory } from '@/lib/types';
import { TemplateBrowser, AIChecklistModal } from './template-browser';
import { Plus, X, Sparkles, LayoutTemplate, PenLine, Check, Trash2 } from 'lucide-react';

interface CreateChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (checklistId: string) => void;
  defaultPlanId?: string;
}

type CreationMode = 'manual' | 'ai' | 'template';

interface PreviewItem {
  title: string;
  groupName: string;
  included: boolean;
}

const TEMPLATE_CATEGORIES: { value: ChecklistTemplateCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'travel', label: 'Travel' },
  { value: 'event', label: 'Event' },
  { value: 'work', label: 'Work' },
  { value: 'home', label: 'Home' },
  { value: 'health', label: 'Health' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];

export default function CreateChecklistModal({ isOpen, onClose, onCreated, defaultPlanId }: CreateChecklistModalProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<CreationMode>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [planId, setPlanId] = useState(defaultPlanId || '');
  const [plans, setPlans] = useState<{ id: string; title: string }[]>([]);

  // AI / Template preview state
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/plans').then(r => r.json()).then(d => setPlans(d.plans?.map((p: { id?: string; _id?: string; title: string }) => ({ id: p._id || p.id, title: p.title })) || []));
    }
  }, [isOpen]);

  const resetState = () => {
    setStep(1);
    setMode('manual');
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setPlanId(defaultPlanId || '');
    setPreviewItems([]);
    setPreviewTitle('');
    setSelectedTemplateId('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleModeSelect = (m: CreationMode) => {
    setMode(m);
    if (m === 'ai') {
      setShowAIModal(true);
    } else if (m === 'template') {
      setShowTemplateBrowser(true);
    } else {
      setStep(2);
    }
  };

  const handleAIGenerated = (result: AIChecklistGenerationResult) => {
    setShowAIModal(false);
    setPreviewTitle(result.title);
    const items: PreviewItem[] = result.groups.flatMap(g =>
      g.items.map(item => ({ title: item, groupName: g.groupName, included: true }))
    );
    setPreviewItems(items);
    setTitle(result.title);
    setStep(3);
  };

  const handleTemplateSelected = async (templateId: string, templateTitle: string) => {
    setShowTemplateBrowser(false);
    setSelectedTemplateId(templateId);
    setPreviewTitle(templateTitle);
    setTitle(templateTitle);
    // Fetch template items for preview
    const res = await fetch(`/api/checklists/templates?id=${templateId}`);
    const data = await res.json();
    if (data.template?.items) {
      setPreviewItems(data.template.items.map((item: { title: string; groupName: string }) => ({
        title: item.title,
        groupName: item.groupName || '',
        included: true,
      })));
    }
    setStep(3);
  };

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
      if (data.checklist) {
        resetState();
        onCreated(data.checklist.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFromPreview = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const includedItems = previewItems.filter(i => i.included);
      let res;
      if (mode === 'template' && selectedTemplateId) {
        res = await fetch('/api/checklists/from-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: selectedTemplateId, title: title.trim(), planId: planId || null }),
        });
      } else {
        res = await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), description,
            dueDate: dueDate || null, dueTime: dueTime || null, planId: planId || null,
            items: includedItems.map(i => ({ title: i.title, groupName: i.groupName })),
          }),
        });
      }
      const data = await res.json();
      if (data.checklist) {
        resetState();
        onCreated(data.checklist.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItem = (idx: number) => {
    setPreviewItems(prev => prev.map((item, i) => i === idx ? { ...item, included: !item.included } : item));
  };

  if (!isOpen) return null;

  const groups = previewItems.reduce((acc, item) => {
    const key = item.groupName || 'Ungrouped';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, PreviewItem[]>);

  const globalIdx = (groupName: string, localIdx: number) => {
    let offset = 0;
    for (const [key, items] of Object.entries(groups)) {
      if (key === groupName) return offset + localIdx;
      offset += items.length;
    }
    return localIdx;
  };

  return (
    <>
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-sheet" onClick={e => e.stopPropagation()}>
          {/* Steps indicator */}
          <div className="steps-row">
            {[1, 2, 3].map(s => (
              <div key={s} className={`step-dot${step >= s ? ' done' : ''}`} />
            ))}
          </div>

          {/* Step 1: Mode picker */}
          {step === 1 && (
            <>
              <div className="modal-header">
                <h2>Create Checklist</h2>
                <button className="close-btn" onClick={handleClose}><X size={18} /></button>
              </div>
              <div className="mode-grid">
                <button className="mode-card" onClick={() => handleModeSelect('manual')}>
                  <div className="mode-icon manual-icon"><PenLine size={22} /></div>
                  <h3>Manual</h3>
                  <p>Start with a blank checklist and add items yourself</p>
                </button>
                <button className="mode-card mode-ai" onClick={() => handleModeSelect('ai')}>
                  <div className="mode-icon ai-icon"><Sparkles size={22} /></div>
                  <h3>AI Generate</h3>
                  <p>Describe your task and AI will create a grouped checklist</p>
                </button>
                <button className="mode-card mode-template" onClick={() => handleModeSelect('template')}>
                  <div className="mode-icon tpl-icon"><LayoutTemplate size={22} /></div>
                  <h3>From Template</h3>
                  <p>Pick from community-shared templates and customize</p>
                </button>
              </div>
            </>
          )}

          {/* Step 2: Manual form */}
          {step === 2 && mode === 'manual' && (
            <>
              <div className="modal-header">
                <button className="back-link" onClick={() => setStep(1)}>← Back</button>
                <h2>New Checklist</h2>
                <button className="close-btn" onClick={handleClose}><X size={18} /></button>
              </div>
              <div className="form-body">
                <label className="field-label">Title *</label>
                <input
                  className="field-input"
                  placeholder="e.g. Packing list"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
                <label className="field-label">Description</label>
                <input
                  className="field-input"
                  placeholder="Optional description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
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
              <div className="modal-footer">
                <button className="cancel-btn" onClick={handleClose}>Cancel</button>
                <button className="create-btn" onClick={handleCreateManual} disabled={!title.trim() || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Checklist'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview (AI or Template) */}
          {step === 3 && (
            <>
              <div className="modal-header">
                <button className="back-link" onClick={() => setStep(1)}>← Back</button>
                <h2>{mode === 'ai' ? 'Review AI Checklist' : 'Review Template'}</h2>
                <button className="close-btn" onClick={handleClose}><X size={18} /></button>
              </div>
              <div className="form-body">
                <label className="field-label">Title</label>
                <input
                  className="field-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
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
                <label className="field-label preview-label">
                  Items preview
                  <span className="item-count">{previewItems.filter(i => i.included).length} selected</span>
                </label>
                <div className="preview-list">
                  {Object.entries(groups).map(([groupName, items]) => (
                    <div key={groupName} className="preview-group">
                      {groupName !== 'Ungrouped' && <div className="preview-group-name">{groupName}</div>}
                      {items.map((item, localIdx) => {
                        const gIdx = globalIdx(groupName, localIdx);
                        return (
                          <div key={gIdx} className={`preview-item${item.included ? '' : ' excluded'}`}>
                            <button className="item-toggle" onClick={() => toggleItem(gIdx)}>
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
              <div className="modal-footer">
                <button className="cancel-btn" onClick={handleClose}>Cancel</button>
                <button className="create-btn" onClick={handleCreateFromPreview} disabled={!title.trim() || previewItems.filter(i => i.included).length === 0 || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Save Checklist'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AIChecklistModal
        isOpen={showAIModal}
        onClose={() => { setShowAIModal(false); }}
        onGenerated={handleAIGenerated}
      />

      <TemplateBrowser
        isOpen={showTemplateBrowser}
        onClose={() => setShowTemplateBrowser(false)}
        onSelect={handleTemplateSelected}
      />

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          z-index: 150; display: flex; align-items: flex-end;
        }
        .modal-sheet {
          width: 100%; max-height: 90vh; background: var(--background, white);
          border-radius: 20px 20px 0 0; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .steps-row {
          display: flex; justify-content: center; gap: 6px; padding: 12px 20px 0;
        }
        .step-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--border, #e5e7eb); transition: background 0.2s;
        }
        .step-dot.done { background: var(--primary, #6366f1); }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; border-bottom: 1px solid var(--border);
        }
        .modal-header h2 { font-size: 17px; font-weight: 700; margin: 0; flex: 1; text-align: center; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--muted-foreground); padding: 4px; }
        .back-link { background: none; border: none; cursor: pointer; color: var(--primary); font-size: 13px; }
        .mode-grid { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px 20px; }
        .mode-card {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px; border: 1.5px solid var(--border); border-radius: 14px;
          background: var(--background); cursor: pointer; text-align: left;
          transition: all 0.15s;
        }
        .mode-card:hover { border-color: var(--primary); }
        .mode-ai { border-color: #c4b5fd; background: linear-gradient(135deg, #faf5ff, #f5f3ff); }
        .mode-template { border-color: #a7f3d0; background: linear-gradient(135deg, #f0fdf4, #ecfdf5); }
        .mode-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .manual-icon { background: var(--muted, #f3f4f6); color: var(--foreground); }
        .ai-icon { background: linear-gradient(135deg, #ede9fe, #ddd6fe); color: #7c3aed; }
        .tpl-icon { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #059669; }
        .mode-card h3 { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: var(--foreground); }
        .mode-card p { font-size: 13px; color: var(--muted-foreground); margin: 0; }
        .form-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .field-label { font-size: 13px; font-weight: 600; color: var(--foreground); }
        .field-input {
          width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px;
          font-size: 14px; background: var(--background); color: var(--foreground); outline: none;
        }
        .field-input:focus { border-color: var(--primary, #6366f1); }
        .row-fields { display: flex; gap: 10px; }
        .field-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .preview-label { display: flex; align-items: center; justify-content: space-between; }
        .item-count { font-size: 12px; color: var(--muted-foreground); font-weight: 400; }
        .preview-list {
          border: 1px solid var(--border); border-radius: 10px;
          max-height: 240px; overflow-y: auto;
        }
        .preview-group { }
        .preview-group-name {
          padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--muted-foreground); background: var(--muted, #f9fafb);
          border-bottom: 1px solid var(--border);
        }
        .preview-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--foreground);
        }
        .preview-item:last-child { border-bottom: none; }
        .preview-item.excluded { opacity: 0.4; text-decoration: line-through; }
        .item-toggle {
          width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid var(--primary, #6366f1); background: var(--primary, #6366f1);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: white;
        }
        .excluded .item-toggle { background: transparent; border-color: var(--border); }
        .modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 12px 20px; border-top: 1px solid var(--border);
        }
        .cancel-btn {
          padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border);
          background: transparent; cursor: pointer; font-size: 14px; color: var(--foreground);
        }
        .create-btn {
          padding: 10px 24px; border-radius: 10px; border: none;
          background: var(--primary, #6366f1); color: white;
          cursor: pointer; font-size: 14px; font-weight: 600;
        }
        .create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .create-btn:hover:not(:disabled) { opacity: 0.9; }
      `}</style>
    </>
  );
}
