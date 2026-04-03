'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Checklist, ChecklistItem } from '@/lib/types';
import { ChecklistItemRow } from './checklist-item-row';
import { ArrowLeft, Share2, Plus, Copy, Check, AlertCircle } from 'lucide-react';

interface ChecklistDetailProps {
  checklistId?: string;
  shareToken?: string;
  onBack: () => void;
}

function groupItems(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.groupName || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

export default function ChecklistDetail({ checklistId, shareToken, onBack }: ChecklistDetailProps) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemGroup, setNewItemGroup] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isOwner = !shareToken;
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = shareToken
      ? `/api/checklists?share=${shareToken}`
      : `/api/checklists?id=${checklistId}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setChecklist(data.checklist);
      })
      .catch(() => setError('Failed to load checklist'))
      .finally(() => setIsLoading(false));
  }, [checklistId, shareToken]);

  const completedCount = checklist?.items.filter(i => i.completed).length ?? 0;
  const totalCount = checklist?.items.length ?? 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = async (id: string, completed: boolean) => {
    if (!checklist) return;
    setChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, completed } : i),
    } : null);
    await fetch('/api/checklists/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checklistId: checklist.id, completed }),
    });
  };

  const handleUpdate = async (id: string, fields: Partial<ChecklistItem>) => {
    if (!checklist) return;
    setChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...fields } : i),
    } : null);
    await fetch('/api/checklists/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checklistId: checklist.id, ...fields }),
    });
  };

  const handleDelete = async (id: string) => {
    if (!checklist) return;
    setChecklist(prev => prev ? {
      ...prev,
      items: prev.items.filter(i => i.id !== id),
    } : null);
    await fetch(`/api/checklists/items?id=${id}&checklistId=${checklist.id}`, { method: 'DELETE' });
  };

  const handleAddItem = async () => {
    if (!checklist || !newItemTitle.trim()) return;
    setAddingItem(true);
    try {
      const res = await fetch('/api/checklists/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId: checklist.id,
          title: newItemTitle.trim(),
          groupName: newItemGroup.trim(),
        }),
      });
      const data = await res.json();
      if (data.item) {
        setChecklist(prev => prev ? { ...prev, items: [...prev.items, data.item] } : null);
        setNewItemTitle('');
      }
    } finally {
      setAddingItem(false);
      addInputRef.current?.focus();
    }
  };

  const handleShare = async () => {
    if (!checklist) return;
    if (checklist.shareLink) {
      setShareLink(checklist.shareLink);
      return;
    }
    const res = await fetch('/api/checklists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: checklist.id }),
    });
    const data = await res.json();
    if (data.shareLink) {
      setShareLink(data.shareLink);
      setChecklist(prev => prev ? { ...prev, shareLink: data.shareLink, isPublic: true } : null);
    }
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(`${window.location.origin}/?cshare=${shareLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dueDateInfo = (() => {
    if (!checklist?.dueDate) return null;
    const due = new Date(checklist.dueDate + (checklist.dueTime ? `T${checklist.dueTime}` : ''));
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`, color: '#ef4444' };
    if (diffDays === 0) return { text: 'Due today', color: '#f97316' };
    if (diffDays === 1) return { text: 'Due tomorrow', color: '#f59e0b' };
    return { text: `Due in ${diffDays} days`, color: '#6b7280' };
  })();

  if (isLoading) {
    return (
      <div className="checklist-detail loading-state">
        <div className="loading-spinner" />
        <style jsx>{`
          .loading-state { display: flex; align-items: center; justify-content: center; min-height: 200px; }
          .loading-spinner {
            width: 40px; height: 40px; border-radius: 50%;
            border: 3px solid var(--border, #e5e7eb);
            border-top-color: var(--primary, #6366f1);
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="checklist-detail error-state">
        <AlertCircle size={40} color="#ef4444" />
        <p>{error || 'Checklist not found'}</p>
        <button onClick={onBack}>Go back</button>
        <style jsx>{`
          .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; text-align: center; }
          button { padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; }
        `}</style>
      </div>
    );
  }

  const groups = groupItems(checklist.items);
  const ungrouped = groups.get('') || [];
  const namedGroups = Array.from(groups.entries()).filter(([k]) => k !== '');

  return (
    <div className="checklist-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        {isOwner && (
          <button className="share-btn" onClick={handleShare}>
            <Share2 size={16} />
            Share
          </button>
        )}
      </div>

      {shareToken && (
        <div className="shared-banner">
          <Share2 size={14} />
          Shared with you — read only
        </div>
      )}

      {shareLink && (
        <div className="share-panel">
          <span className="share-url">{`${typeof window !== 'undefined' ? window.location.origin : ''}/?cshare=${shareLink}`}</span>
          <button className="copy-btn" onClick={handleCopyLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Title + Meta */}
      <div className="detail-meta">
        <h1 className="detail-title">{checklist.title}</h1>
        {checklist.description && <p className="detail-desc">{checklist.description}</p>}
        <div className="detail-badges">
          {dueDateInfo && (
            <span className="due-badge" style={{ color: dueDateInfo.color }}>
              {dueDateInfo.text}
            </span>
          )}
          {checklist.planId && (
            <span className="plan-badge">Linked to plan</span>
          )}
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="progress-section">
          <div className="progress-label">
            <span>{completedCount} of {totalCount} completed</span>
            <span className="progress-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="items-section">
        {ungrouped.length > 0 && ungrouped.map(item => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            isOwner={isOwner}
            onToggle={handleToggle}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}

        {namedGroups.map(([groupName, items]) => (
          <div key={groupName} className="item-group">
            <div className="group-header">
              <span className="group-name">{groupName}</span>
              <span className="group-count">
                {items.filter(i => i.completed).length}/{items.length}
              </span>
            </div>
            {items.map(item => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                isOwner={isOwner}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}

        {totalCount === 0 && isOwner && (
          <div className="empty-items">
            <p>No items yet. Add your first item below.</p>
          </div>
        )}

        {/* Add item row */}
        {isOwner && (
          <div className="add-item-row">
            <Plus size={16} className="add-icon" />
            <input
              ref={addInputRef}
              className="add-input"
              placeholder="Add an item..."
              value={newItemTitle}
              onChange={e => setNewItemTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddItem();
              }}
            />
            {namedGroups.length > 0 && (
              <select
                className="group-select"
                value={newItemGroup}
                onChange={e => setNewItemGroup(e.target.value)}
              >
                <option value="">Ungrouped</option>
                {namedGroups.map(([g]) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}
            <button
              className="add-btn"
              onClick={handleAddItem}
              disabled={!newItemTitle.trim() || addingItem}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .checklist-detail {
          max-width: 680px;
          margin: 0 auto;
          padding: 20px 16px 60px;
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted-foreground, #6b7280);
          font-size: 14px;
          padding: 6px 0;
        }
        .back-btn:hover { color: var(--foreground); }
        .share-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background, white);
          cursor: pointer;
          font-size: 13px;
          color: var(--foreground);
        }
        .share-btn:hover { background: var(--muted, #f3f4f6); }
        .shared-banner {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          font-size: 13px;
          color: #1d4ed8;
          margin-bottom: 16px;
        }
        .share-panel {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--muted, #f9fafb);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .share-url {
          flex: 1;
          font-size: 12px;
          color: var(--muted-foreground);
          word-break: break-all;
        }
        .copy-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--background, white);
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .detail-meta { margin-bottom: 20px; }
        .detail-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 6px;
        }
        .detail-desc {
          font-size: 14px;
          color: var(--muted-foreground);
          margin: 0 0 10px;
        }
        .detail-badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .due-badge {
          font-size: 12px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--muted, #f3f4f6);
        }
        .plan-badge {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 10px;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .progress-section { margin-bottom: 24px; }
        .progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--muted-foreground);
          margin-bottom: 6px;
        }
        .progress-pct { font-weight: 600; color: var(--primary, #6366f1); }
        .progress-track {
          height: 8px;
          background: var(--muted, #e5e7eb);
          border-radius: 99px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--primary, #6366f1);
          border-radius: 99px;
          transition: width 0.3s ease;
        }
        .items-section { display: flex; flex-direction: column; gap: 2px; }
        .item-group { margin-top: 16px; }
        .group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 4px;
          margin-bottom: 4px;
        }
        .group-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .group-count {
          font-size: 12px;
          color: var(--muted-foreground);
        }
        .empty-items {
          text-align: center;
          padding: 32px 0;
          color: var(--muted-foreground);
          font-size: 14px;
        }
        .add-item-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 2px dashed var(--border, #e5e7eb);
        }
        .add-icon { color: var(--muted-foreground); }
        .add-input {
          flex: 1;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          background: var(--background, white);
          color: var(--foreground);
          outline: none;
        }
        .add-input:focus { border-color: var(--primary, #6366f1); }
        .group-select {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 13px;
          background: var(--background, white);
          color: var(--foreground);
          cursor: pointer;
        }
        .add-btn {
          padding: 8px 16px;
          border-radius: 8px;
          background: var(--primary, #6366f1);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
        }
        .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .add-btn:hover:not(:disabled) { opacity: 0.9; }
      `}</style>
    </div>
  );
}
