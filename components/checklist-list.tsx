'use client';

import React, { useState, useEffect } from 'react';
import { Checklist } from '@/lib/types';
import { ChecklistCard } from './checklist-card';
import { ConfirmDialog } from './confirm-dialog';
import { Plus, CheckSquare, Sparkles, LayoutTemplate, PenLine } from 'lucide-react';

interface ChecklistListProps {
  onSelectChecklist: (id: string) => void;
  onCreateChecklist: () => void;
}

export function ChecklistList({ onSelectChecklist, onCreateChecklist }: ChecklistListProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [sharedChecklists, setSharedChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareLinkMap, setShareLinkMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchChecklists();
    fetchSharedChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const res = await fetch('/api/checklists');
      const data = await res.json();
      setChecklists(data.checklists || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSharedChecklists = async () => {
    try {
      const res = await fetch('/api/checklists?tab=shared');
      const data = await res.json();
      setSharedChecklists(data.checklists || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/checklists?id=${deleteId}`, { method: 'DELETE' });
    setChecklists(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
  };

  const handleShare = async (id: string) => {
    const existing = checklists.find(c => c.id === id);
    if (existing?.shareLink) {
      setShareLinkMap(prev => ({ ...prev, [id]: existing.shareLink! }));
      return;
    }
    const res = await fetch('/api/checklists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.shareLink) {
      setShareLinkMap(prev => ({ ...prev, [id]: data.shareLink }));
      setChecklists(prev => prev.map(c => c.id === id ? { ...c, shareLink: data.shareLink, isPublic: true } : c));
      navigator.clipboard.writeText(`${window.location.origin}/?cshare=${data.shareLink}`).catch(() => {});
    }
  };

  const filtered = (tab === 'mine' ? checklists : sharedChecklists).filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="list-loading">
        {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
        <style jsx>{`
          .list-loading { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
          .skeleton-card { height: 120px; border-radius: 14px; background: var(--muted, #f3f4f6); animation: pulse 1.5s ease-in-out infinite; }
          @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        `}</style>
      </div>
    );
  }

  return (
    <div className="checklist-list">
      {/* Tab bar */}
      <div className="tabs-bar">
        <button
          className={`tab-btn${tab === 'mine' ? ' active' : ''}`}
          onClick={() => setTab('mine')}
        >
          My Checklists
          {checklists.length > 0 && <span className="tab-badge">{checklists.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'shared' ? ' active' : ''}`}
          onClick={() => setTab('shared')}
        >
          Shared with Me
          {sharedChecklists.length > 0 && <span className="tab-badge">{sharedChecklists.length}</span>}
        </button>
      </div>

      {/* Search */}
      {filtered.length > 2 && (
        <div className="search-row">
          <input
            className="search-input"
            placeholder="Search checklists..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {tab === 'mine' && checklists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><CheckSquare size={32} /></div>
          <h3>No checklists yet</h3>
          <p>Stay organized with smart checklists</p>
          <div className="creation-chips">
            <button className="chip" onClick={onCreateChecklist}>
              <PenLine size={16} />
              Manual
            </button>
            <button className="chip chip-ai" onClick={onCreateChecklist}>
              <Sparkles size={16} />
              AI Generate
            </button>
            <button className="chip chip-template" onClick={onCreateChecklist}>
              <LayoutTemplate size={16} />
              From Template
            </button>
          </div>
        </div>
      ) : tab === 'shared' && sharedChecklists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><CheckSquare size={32} /></div>
          <h3>No shared checklists</h3>
          <p>Checklists shared with you will appear here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="no-results">No checklists match your search</div>
      ) : (
        <div className="cards-grid">
          {filtered.map(checklist => (
            <ChecklistCard
              key={checklist.id}
              checklist={checklist}
              onOpen={() => onSelectChecklist(checklist.id)}
              onShare={() => handleShare(checklist.id)}
              onDelete={() => setDeleteId(checklist.id)}
              showMenu={menuId === checklist.id}
              onToggleMenu={() => setMenuId(prev => prev === checklist.id ? null : checklist.id)}
            />
          ))}
          {tab === 'mine' && (
            <button className="create-card" onClick={onCreateChecklist}>
              <Plus size={24} />
              <span>New Checklist</span>
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Checklist"
        message="This will permanently delete the checklist and all its items. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <style jsx>{`
        .checklist-list { padding: 0 0 40px; }
        .tabs-bar {
          display: flex;
          border-bottom: 2px solid var(--border, #e5e7eb);
          margin-bottom: 20px;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted-foreground, #6b7280);
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: color 0.15s;
        }
        .tab-btn.active { color: var(--primary, #6366f1); border-bottom-color: var(--primary, #6366f1); }
        .tab-badge {
          background: var(--primary, #6366f1);
          color: white;
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 99px;
          font-weight: 600;
        }
        .search-row { margin-bottom: 16px; }
        .search-input {
          width: 100%;
          padding: 8px 14px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          font-size: 14px;
          background: var(--background, white);
          color: var(--foreground);
          outline: none;
        }
        .search-input:focus { border-color: var(--primary, #6366f1); }
        .empty-state {
          text-align: center;
          padding: 60px 20px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c3aed;
        }
        .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--foreground); margin: 0; }
        .empty-state p { font-size: 14px; color: var(--muted-foreground); margin: 0; }
        .creation-chips {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 8px;
        }
        .chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 99px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background, white);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          transition: all 0.15s;
        }
        .chip:hover { background: var(--muted, #f3f4f6); }
        .chip-ai { background: linear-gradient(135deg, #ede9fe, #ddd6fe); border-color: #c4b5fd; color: #7c3aed; }
        .chip-ai:hover { background: linear-gradient(135deg, #ddd6fe, #c4b5fd); }
        .chip-template { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-color: #a7f3d0; color: #059669; }
        .chip-template:hover { background: linear-gradient(135deg, #d1fae5, #a7f3d0); }
        .no-results { text-align: center; padding: 40px; color: var(--muted-foreground); font-size: 14px; }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .create-card {
          border: 2px dashed var(--border, #e5e7eb);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 120px;
          cursor: pointer;
          background: transparent;
          color: var(--muted-foreground, #9ca3af);
          font-size: 14px;
          font-weight: 500;
          transition: all 0.15s;
        }
        .create-card:hover {
          border-color: var(--primary, #6366f1);
          color: var(--primary, #6366f1);
          background: var(--muted, #f5f3ff);
        }
      `}</style>
    </div>
  );
}
