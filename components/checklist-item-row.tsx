'use client';

import React, { useState } from 'react';
import { ChecklistItem } from '@/lib/types';
import { Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface ChecklistItemRowProps {
  item: ChecklistItem;
  isOwner: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, fields: Partial<ChecklistItem>) => void;
  onDelete: (id: string) => void;
}

export function ChecklistItemRow({ item, isOwner, onToggle, onUpdate, onDelete }: ChecklistItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [showNotes, setShowNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleTitleBlur = () => {
    setEditing(false);
    if (editTitle.trim() && editTitle !== item.title) {
      onUpdate(item.id, { title: editTitle.trim() });
    } else {
      setEditTitle(item.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleBlur();
    if (e.key === 'Escape') { setEditing(false); setEditTitle(item.title); }
  };

  const dueDateLabel = (() => {
    if (!item.dueDate) return null;
    const due = new Date(item.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `Overdue ${Math.abs(diff)}d`, color: '#ef4444' };
    if (diff === 0) return { text: 'Due today', color: '#f97316' };
    if (diff === 1) return { text: 'Due tomorrow', color: '#f59e0b' };
    return { text: `Due in ${diff}d`, color: '#6b7280' };
  })();

  return (
    <div className={`checklist-item-row${item.completed ? ' completed' : ''}`}>
      {/* Checkbox — immediate toggle, no selection step */}
      <button
        className="item-checkbox"
        onClick={() => isOwner && onToggle(item.id, !item.completed)}
        disabled={!isOwner}
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.completed && <Check size={14} strokeWidth={3} />}
      </button>

      <div className="item-content">
        {editing && isOwner ? (
          <input
            className="item-title-input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className="item-title"
            onDoubleClick={() => isOwner && setEditing(true)}
            title={isOwner ? 'Double-click to edit' : undefined}
          >
            {item.title}
          </span>
        )}

        {dueDateLabel && !item.completed && (
          <span className="item-due-badge" style={{ color: dueDateLabel.color }}>
            {dueDateLabel.text}
          </span>
        )}

        {item.notes && (
          <button className="item-notes-toggle" onClick={() => setShowNotes(s => !s)}>
            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Notes
          </button>
        )}
      </div>

      {/* Delete button — always visible for owners; shows inline confirmation on tap */}
      {isOwner && !confirmDelete && (
        <button
          className="item-delete-btn"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete item"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Inline delete confirmation — no modal needed */}
      {isOwner && confirmDelete && (
        <div className="delete-confirm">
          <span className="delete-confirm-label">Delete?</span>
          <button className="dc-cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="dc-confirm" onClick={() => { setConfirmDelete(false); onDelete(item.id); }}>Delete</button>
        </div>
      )}

      {showNotes && item.notes && (
        <div className="item-notes">{item.notes}</div>
      )}

      <style jsx>{`
        .checklist-item-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 4px;
          border-bottom: 1px solid var(--border, #e5e7eb);
          border-radius: 6px;
          flex-wrap: wrap;
          -webkit-tap-highlight-color: transparent;
        }
        .checklist-item-row.completed .item-title {
          text-decoration: line-through;
          opacity: 0.5;
        }
        .item-checkbox {
          width: 26px;
          height: 26px;
          min-width: 26px;
          border-radius: 50%;
          border: 2px solid var(--primary, #6366f1);
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          transition: background 0.15s, border-color 0.15s;
          color: white;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .item-checkbox:disabled {
          cursor: default;
          opacity: 0.7;
        }
        .completed .item-checkbox {
          background: var(--primary, #6366f1);
          border-color: var(--primary, #6366f1);
        }
        .item-content {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .item-title {
          font-size: 14px;
          color: var(--foreground, #111827);
          word-break: break-word;
          flex: 1;
          min-width: 100px;
          user-select: none;
          -webkit-user-select: none;
        }
        .item-title-input {
          font-size: 14px;
          border: 1px solid var(--primary, #6366f1);
          border-radius: 4px;
          padding: 2px 6px;
          flex: 1;
          min-width: 100px;
          outline: none;
          background: var(--background, white);
          color: var(--foreground, #111827);
        }
        .item-due-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: 10px;
          background: var(--muted, #f3f4f6);
          white-space: nowrap;
        }
        .item-notes-toggle {
          font-size: 11px;
          color: var(--muted-foreground, #6b7280);
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 0;
          touch-action: manipulation;
        }

        /* Delete button — always visible on touch, subtle on desktop */
        .item-delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted-foreground, #9ca3af);
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          opacity: 0.45;
          transition: opacity 0.15s, color 0.15s;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }
        .checklist-item-row:hover .item-delete-btn { opacity: 1; }
        .item-delete-btn:hover { color: #ef4444; background: #fef2f2; opacity: 1; }
        /* On touch devices, always show at readable opacity */
        @media (hover: none) {
          .item-delete-btn { opacity: 0.6; }
        }

        /* Inline delete confirmation */
        .delete-confirm {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .delete-confirm-label {
          font-size: 12px;
          color: #ef4444;
          font-weight: 600;
          white-space: nowrap;
        }
        .dc-cancel {
          font-size: 12px; padding: 3px 8px;
          border: 1px solid var(--border); border-radius: 6px;
          background: var(--background); color: var(--foreground);
          cursor: pointer; touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .dc-confirm {
          font-size: 12px; padding: 3px 8px;
          border: none; border-radius: 6px;
          background: #ef4444; color: white;
          cursor: pointer; font-weight: 600;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .item-notes {
          width: 100%;
          padding: 6px 10px;
          margin-top: 4px;
          font-size: 13px;
          color: var(--muted-foreground, #6b7280);
          background: var(--muted, #f9fafb);
          border-radius: 6px;
          border-left: 3px solid var(--primary, #6366f1);
        }
      `}</style>
    </div>
  );
}
