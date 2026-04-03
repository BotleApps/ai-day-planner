'use client';

import React from 'react';
import { Checklist } from '@/lib/types';
import { MoreVertical, Calendar, CheckSquare, Share2, Trash2, Link2 } from 'lucide-react';

interface ChecklistCardProps {
  checklist: Checklist;
  onOpen: () => void;
  onShare: () => void;
  onDelete: () => void;
  showMenu: boolean;
  onToggleMenu: () => void;
}

export function ChecklistCard({ checklist, onOpen, onShare, onDelete, showMenu, onToggleMenu }: ChecklistCardProps) {
  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter(i => i.completed).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const dueDateInfo = (() => {
    if (!checklist.dueDate) return null;
    const due = new Date(checklist.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `Overdue ${Math.abs(diff)}d`, color: '#ef4444', bg: '#fef2f2' };
    if (diff === 0) return { text: 'Due today', color: '#f97316', bg: '#fff7ed' };
    if (diff === 1) return { text: 'Tomorrow', color: '#f59e0b', bg: '#fffbeb' };
    return { text: `${diff}d left`, color: '#6b7280', bg: '#f9fafb' };
  })();

  return (
    <div className="checklist-card" onClick={onOpen}>
      <div className="card-top">
        <div className="card-icon">
          <CheckSquare size={18} />
        </div>
        <div className="card-badges">
          {checklist.planId && (
            <span className="plan-badge">
              <Link2 size={10} />
              Plan
            </span>
          )}
          {dueDateInfo && (
            <span className="due-badge" style={{ color: dueDateInfo.color, background: dueDateInfo.bg }}>
              <Calendar size={10} />
              {dueDateInfo.text}
            </span>
          )}
        </div>
        <button
          className="menu-btn"
          onClick={e => { e.stopPropagation(); onToggleMenu(); }}
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>
        {showMenu && (
          <div className="card-menu" onClick={e => e.stopPropagation()}>
            <button onClick={() => { onOpen(); onToggleMenu(); }}>Open</button>
            <button onClick={() => { onShare(); onToggleMenu(); }}>
              <Share2 size={13} /> Share
            </button>
            <button className="delete-item" onClick={() => { onDelete(); onToggleMenu(); }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="card-body">
        <h3 className="card-title">{checklist.title}</h3>
        {checklist.description && (
          <p className="card-desc">{checklist.description}</p>
        )}
      </div>

      <div className="card-footer">
        <div className="item-count">
          <CheckSquare size={13} />
          {completedItems}/{totalItems} items
        </div>
        {totalItems > 0 && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <style jsx>{`
        .checklist-card {
          background: var(--card, white);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .checklist-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        .card-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .card-badges {
          display: flex;
          gap: 6px;
          flex: 1;
          flex-wrap: wrap;
        }
        .due-badge, .plan-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 10px;
        }
        .plan-badge {
          background: #eff6ff;
          color: #1d4ed8;
        }
        .menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted-foreground, #9ca3af);
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .menu-btn:hover { background: var(--muted, #f3f4f6); }
        .card-menu {
          position: absolute;
          top: 44px;
          right: 12px;
          background: var(--card, white);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          z-index: 20;
          min-width: 130px;
          overflow: hidden;
        }
        .card-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: var(--foreground);
          text-align: left;
        }
        .card-menu button:hover { background: var(--muted, #f9fafb); }
        .card-menu button.delete-item:hover { background: #fef2f2; color: #ef4444; }
        .card-body { flex: 1; }
        .card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--foreground);
          margin: 0 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-footer {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .item-count {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted-foreground);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .progress-track {
          flex: 1;
          height: 6px;
          background: var(--muted, #e5e7eb);
          border-radius: 99px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 99px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
