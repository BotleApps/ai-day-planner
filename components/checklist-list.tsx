'use client';

import React, { useState, useEffect } from 'react';
import { Checklist } from '@/lib/types';
import { ChecklistCard } from './checklist-card';
import { ConfirmDialog } from './confirm-dialog';
import { TemplatesSection } from './templates-section';
import { CheckSquare, LayoutTemplate, Share2, Search, X, Filter, ArrowUpDown } from 'lucide-react';

interface ChecklistListProps {
  onSelectChecklist: (id: string) => void;
  onCreateChecklist: (mode?: 'manual' | 'ai' | 'template') => void;
  onUseTemplate: (templateId: string) => void;
}

export function ChecklistList({ onSelectChecklist, onCreateChecklist, onUseTemplate }: ChecklistListProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [sharedChecklists, setSharedChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'shared' | 'templates'>('mine');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [checklistSort, setChecklistSort] = useState<'newest' | 'oldest' | 'az' | 'items'>('newest');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

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

  const handleShare = (id: string) => {
    onSelectChecklist(id);
  };

  const processChecklists = (list: Checklist[]) => {
    let result = list.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (checklistFilter === 'completed')
      result = result.filter(c => c.items.length > 0 && c.items.every(i => i.completed));
    else if (checklistFilter === 'in-progress')
      result = result.filter(c => c.items.length > 0 && !c.items.every(i => i.completed));
    result = [...result].sort((a, b) => {
      if (checklistSort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (checklistSort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (checklistSort === 'az') return a.title.localeCompare(b.title);
      if (checklistSort === 'items') return b.items.length - a.items.length;
      return 0;
    });
    return result;
  };

  const filtered = processChecklists(tab === 'mine' ? checklists : sharedChecklists);
  const activeList = tab === 'mine' ? checklists : sharedChecklists;
  const showToolbar = tab !== 'templates' && activeList.length > 0;

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
      {/* Search / Filter / Sort toolbar — shown when list has items */}
      {showToolbar && (
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={15} className="sf-icon" />
            <input
              type="text"
              placeholder="Search checklists..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="sf-clear" onClick={() => setSearchQuery('')}><X size={13} /></button>
            )}
          </div>
          <div className="toolbar-btns">
            <div className="tb-wrap">
              <button
                className={`tb-btn${checklistFilter !== 'all' ? ' tb-active' : ''}`}
                title="Filter"
                onClick={() => { setShowFilter(f => !f); setShowSort(false); }}
              >
                <Filter size={15} />
              </button>
              {showFilter && (
                <div className="tb-dropdown">
                  <p className="tb-dd-title">Filter</p>
                  {(['all', 'in-progress', 'completed'] as const).map(f => (
                    <button
                      key={f}
                      className={`tb-dd-opt${checklistFilter === f ? ' selected' : ''}`}
                      onClick={() => { setChecklistFilter(f); setShowFilter(false); }}
                    >
                      {f === 'all' ? 'All checklists' : f === 'in-progress' ? 'In progress' : 'Completed'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="tb-wrap">
              <button
                className={`tb-btn${checklistSort !== 'newest' ? ' tb-active' : ''}`}
                title="Sort"
                onClick={() => { setShowSort(s => !s); setShowFilter(false); }}
              >
                <ArrowUpDown size={15} />
              </button>
              {showSort && (
                <div className="tb-dropdown">
                  <p className="tb-dd-title">Sort by</p>
                  {(['newest', 'oldest', 'az', 'items'] as const).map(s => (
                    <button
                      key={s}
                      className={`tb-dd-opt${checklistSort === s ? ' selected' : ''}`}
                      onClick={() => { setChecklistSort(s); setShowSort(false); }}
                    >
                      {s === 'newest' ? 'Newest first' : s === 'oldest' ? 'Oldest first' : s === 'az' ? 'A → Z' : 'Most items'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="tabs-bar">
        <button
          className={`tab-btn${tab === 'mine' ? ' active' : ''}`}
          onClick={() => setTab('mine')}
        >
          Mine
          {checklists.length > 0 && <span className="tab-badge">{checklists.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'shared' ? ' active' : ''}`}
          onClick={() => setTab('shared')}
        >
          <Share2 size={13} />
          Shared
          {sharedChecklists.length > 0 && <span className="tab-badge">{sharedChecklists.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'templates' ? ' active' : ''}`}
          onClick={() => setTab('templates')}
        >
          <LayoutTemplate size={13} />
          Templates
        </button>
      </div>

      {/* Templates tab */}
      {tab === 'templates' ? (
        <TemplatesSection onUseTemplate={(id, _title) => onUseTemplate(id)} />
      ) : (
        <>
          {/* Content */}
          {tab === 'mine' && checklists.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><CheckSquare size={32} /></div>
              <h3>No checklists yet</h3>
              <p>Stay organised with smart checklists</p>
              <p className="empty-hint">Tap <strong>+</strong> at the top to get started</p>
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
            </div>
          )}
        </>
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

      {/* Backdrop to close filter/sort dropdowns */}
      {(showFilter || showSort) && (
        <div className="cl-overlay" onClick={() => { setShowFilter(false); setShowSort(false); }} />
      )}

      <style jsx>{`
        .checklist-list { padding: 0 0 40px; position: relative; }

        /* Toolbar */
        .list-toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 0 8px;
        }
        .search-field {
          flex: 1; display: flex; align-items: center; gap: 8px;
          background: var(--muted, #f3f4f6); border-radius: 10px;
          padding: 8px 12px;
        }
        .sf-icon { color: var(--muted-foreground, #9ca3af); flex-shrink: 0; }
        .search-field input {
          flex: 1; border: none; background: none;
          font-size: 14px; color: var(--foreground); outline: none;
        }
        .sf-clear {
          padding: 2px; border: none; background: none;
          color: var(--muted-foreground); cursor: pointer; line-height: 1;
        }
        .toolbar-btns { display: flex; gap: 4px; }
        .tb-wrap { position: relative; }
        .tb-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
          background: var(--background, white); color: var(--muted-foreground, #9ca3af);
          cursor: pointer; transition: all 0.15s;
        }
        .tb-btn:hover { background: var(--muted, #f3f4f6); color: var(--foreground); }
        .tb-btn.tb-active {
          background: color-mix(in srgb, var(--primary, #6366f1) 12%, transparent);
          border-color: var(--primary, #6366f1);
          color: var(--primary, #6366f1);
        }
        .tb-dropdown {
          position: absolute; right: 0; top: calc(100% + 6px); z-index: 201;
          min-width: 160px; background: var(--card, white);
          border: 1px solid var(--border, #e5e7eb); border-radius: 12px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.1); overflow: hidden;
        }
        .tb-dd-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--muted-foreground, #9ca3af);
          padding: 10px 14px 6px; margin: 0;
        }
        .tb-dd-opt {
          display: block; width: 100%; padding: 9px 14px;
          border: none; background: none; text-align: left;
          font-size: 13px; color: var(--foreground); cursor: pointer;
          transition: background 0.1s;
        }
        .tb-dd-opt:hover { background: var(--muted, #f3f4f6); }
        .tb-dd-opt.selected {
          color: var(--primary, #6366f1); font-weight: 600;
          background: color-mix(in srgb, var(--primary, #6366f1) 8%, transparent);
        }
        .cl-overlay { position: fixed; inset: 0; z-index: 199; }

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
        .empty-hint { font-size: 13px; color: var(--muted-foreground); margin-top: 4px !important; }
        .no-results { text-align: center; padding: 40px; color: var(--muted-foreground); font-size: 14px; }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
      `}</style>
    </div>
  );
}
