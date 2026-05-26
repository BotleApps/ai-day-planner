'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutTemplate, Plus, Globe, User,
  Trash2, Upload, CheckCircle2, MoreVertical, BookOpen,
} from 'lucide-react';

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  authorName: string;
  authorId: string;
  isPublished: boolean;
  itemCount: number;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'event', label: '🎉 Event' },
  { value: 'work', label: '💼 Work' },
  { value: 'home', label: '🏠 Home' },
  { value: 'health', label: '💪 Health' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'general', label: '📋 General' },
  { value: 'other', label: '✨ Other' },
];

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  travel:   { bg: '#dbeafe', color: '#1d4ed8' },
  event:    { bg: '#fce7f3', color: '#be185d' },
  work:     { bg: '#e0e7ff', color: '#4338ca' },
  home:     { bg: '#dcfce7', color: '#15803d' },
  health:   { bg: '#fef9c3', color: '#a16207' },
  shopping: { bg: '#fef3c7', color: '#b45309' },
  general:  { bg: '#f3f4f6', color: '#374151' },
  other:    { bg: '#ede9fe', color: '#7c3aed' },
};

interface TemplatesSectionProps {
  onUseTemplate: (templateId: string, templateTitle: string) => void;
  searchQuery?: string;
}

export function TemplatesSection({ onUseTemplate, searchQuery: externalQuery }: TemplatesSectionProps) {
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(externalQuery ?? '');
  const [category, setCategory] = useState('all');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setQuery(externalQuery ?? '');
  }, [externalQuery]);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'mine') {
        params.set('mine', 'true');
      } else {
        if (query) params.set('q', query);
        if (category !== 'all') params.set('category', category);
      }
      const res = await fetch(`/api/checklists/templates?${params}`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setIsLoading(false);
    }
  }, [tab, query, category]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      await fetch('/api/checklists/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, isPublished: true } : t));
    } finally {
      setPublishing(null);
      setMenuId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/checklists/templates?id=${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } finally {
      setDeleting(null);
      setMenuId(null);
    }
  };

  const catStyle = (cat: string) => CAT_COLORS[cat] || CAT_COLORS.general;

  return (
    <div className="ts-container">
      {/* Tab bar */}
      <div className="ts-tabs">
        <button className={`ts-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
          <Globe size={15} />
          Browse
        </button>
        <button className={`ts-tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
          <User size={15} />
          My Templates
        </button>
      </div>

      {/* Category chips — browse only */}
      {tab === 'browse' && (
        <>
          <div className="ts-cats">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                className={`ts-cat${category === cat.value ? ' active' : ''}`}
                onClick={() => setCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      <div className="ts-body">
        {isLoading ? (
          <div className="ts-grid">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="ts-skeleton" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="ts-empty">
            <div className="ts-empty-icon">
              <LayoutTemplate size={32} />
            </div>
            {tab === 'mine' ? (
              <>
                <h3>No templates yet</h3>
                <p>Save a checklist as a template to reuse it anytime</p>
              </>
            ) : (
              <>
                <h3>No templates found</h3>
                <p>{query || category !== 'all' ? 'Try adjusting your search or filters' : 'Be the first to publish a template!'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="ts-grid">
            {templates.map(tpl => {
              const cs = catStyle(tpl.category);
              return (
                <div key={tpl.id} className="ts-card">
                  {/* Card header */}
                  <div className="ts-card-top">
                    <span className="ts-cat-badge" style={{ background: cs.bg, color: cs.color }}>
                      {tpl.category}
                    </span>
                    <div className="ts-card-actions">
                      {tpl.isPublished && (
                        <span className="ts-pub-badge"><Globe size={10} />Public</span>
                      )}
                      {tab === 'mine' && (
                        <div className="ts-menu-wrap">
                          <button
                            className="ts-menu-btn"
                            onClick={() => setMenuId(menuId === tpl.id ? null : tpl.id)}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {menuId === tpl.id && (
                            <div className="ts-menu">
                              {!tpl.isPublished && (
                                <button
                                  className="ts-menu-row"
                                  onClick={() => handlePublish(tpl.id)}
                                  disabled={publishing === tpl.id}
                                >
                                  {publishing === tpl.id ? (
                                    <span className="ts-spinner" />
                                  ) : (
                                    <Upload size={13} />
                                  )}
                                  Publish
                                </button>
                              )}
                              {tpl.isPublished && (
                                <div className="ts-menu-row published-row">
                                  <CheckCircle2 size={13} />
                                  Published
                                </div>
                              )}
                              <div className="ts-menu-divider" />
                              <button
                                className="ts-menu-row ts-menu-danger"
                                onClick={() => handleDelete(tpl.id)}
                                disabled={deleting === tpl.id}
                              >
                                {deleting === tpl.id ? <span className="ts-spinner" /> : <Trash2 size={13} />}
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <h4 className="ts-card-title">{tpl.title}</h4>
                  {tpl.description && <p className="ts-card-desc">{tpl.description}</p>}

                  {/* Card footer */}
                  <div className="ts-card-footer">
                    <div className="ts-card-meta">
                      <span className="ts-item-count"><BookOpen size={11} />{tpl.itemCount} items</span>
                      {tab === 'browse' && tpl.authorName && (
                        <span className="ts-author">by {tpl.authorName}</span>
                      )}
                    </div>
                    <button
                      className="ts-use-btn"
                      onClick={() => onUseTemplate(tpl.id, tpl.title)}
                    >
                      Use
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tap outside to close menus */}
      {menuId && (
        <div className="ts-backdrop" onClick={() => setMenuId(null)} />
      )}

      <style jsx>{`
        .ts-container {
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
        }

        /* Tabs */
        .ts-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          padding: 0 16px;
          gap: 0;
          flex-shrink: 0;
        }
        .ts-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border: none;
          background: none;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted-foreground);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .ts-tab.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }

        /* Category chips */
        .ts-cats {
          display: flex;
          gap: 6px;
          padding: 10px 16px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: none;
        }
        .ts-cats::-webkit-scrollbar { display: none; }
        .ts-cat {
          padding: 6px 14px;
          border-radius: 99px;
          border: 1.5px solid var(--border);
          background: var(--background);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          color: var(--foreground);
          flex-shrink: 0;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .ts-cat.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        /* Body */
        .ts-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px 16px;
        }

        /* Grid */
        .ts-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Skeleton */
        .ts-skeleton {
          height: 110px;
          border-radius: 14px;
          background: var(--muted);
          animation: ts-pulse 1.5s ease-in-out infinite;
        }
        @keyframes ts-pulse { 0%,100%{opacity:1}50%{opacity:0.5} }

        /* Empty */
        .ts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 60px 24px;
          text-align: center;
        }
        .ts-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: color-mix(in srgb, var(--primary) 12%, var(--card));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 4px;
        }
        .ts-empty h3 { font-size: 17px; font-weight: 600; color: var(--foreground); margin: 0; }
        .ts-empty p { font-size: 14px; color: var(--muted-foreground); margin: 0; max-width: 260px; }

        /* Card */
        .ts-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color 0.15s;
        }
        .ts-card:hover { border-color: color-mix(in srgb, var(--primary) 50%, var(--border)); }

        .ts-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ts-cat-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 99px;
          text-transform: capitalize;
        }

        .ts-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ts-pub-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #059669;
          background: color-mix(in srgb, #10b981 15%, var(--card));
          border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
          border-radius: 99px;
          padding: 2px 7px;
        }

        .ts-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0;
          line-height: 1.3;
        }

        .ts-card-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }

        .ts-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        .ts-card-meta {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ts-item-count {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .ts-author {
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .ts-use-btn {
          padding: 7px 18px;
          border-radius: 8px;
          border: none;
          background: var(--primary);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .ts-use-btn:hover { opacity: 0.88; }

        /* Context menu */
        .ts-menu-wrap { position: relative; }
        .ts-menu-btn {
          width: 30px;
          height: 30px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          -webkit-tap-highlight-color: transparent;
        }
        .ts-menu-btn:hover { background: var(--muted); }

        .ts-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.14);
          min-width: 140px;
          z-index: 50;
          overflow: hidden;
        }

        .ts-menu-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
        }
        .ts-menu-row:hover { background: var(--muted); }
        .ts-menu-row:disabled { opacity: 0.5; cursor: not-allowed; }
        .ts-menu-danger { color: #ef4444; }
        .ts-menu-danger:hover { background: color-mix(in srgb, #ef4444 8%, var(--card)); }
        .published-row { color: #059669; cursor: default; }
        .published-row:hover { background: transparent; }

        .ts-menu-divider { height: 1px; background: var(--border); margin: 2px 0; }

        .ts-spinner {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          animation: ts-spin 0.6s linear infinite;
          display: inline-block;
        }
        @keyframes ts-spin { to { transform: rotate(360deg); } }

        .ts-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }
      `}</style>
    </div>
  );
}
