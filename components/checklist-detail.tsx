'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  Checklist,
  ChecklistItem,
  ChecklistShareLinkInfo,
  ChecklistMemberInfo,
} from '@/lib/types';
import { ChecklistItemRow } from './checklist-item-row';
import { ConfirmDialog } from './confirm-dialog';
import { useEscapeKey } from '@/lib/use-escape-key';
import {
  ArrowLeft, Share2, Plus, Copy, Check, AlertCircle,
  Edit2, MoreHorizontal, Trash2, X, Link2, Users, LayoutTemplate,
  Lock, FolderPlus, Pencil, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ChecklistDetailProps {
  checklistId?: string;
  shareToken?: string;
  onBack: () => void;
}

const UNAUTH_VISIBLE_FRACTION = 0.7;

function groupItems(items: ChecklistItem[]): { groupName: string; items: ChecklistItem[] }[] {
  // Preserve insertion order of groups based on item order
  const seen = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.groupName || '';
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(item);
  }
  return Array.from(seen.entries()).map(([groupName, list]) => ({ groupName, items: list }));
}

export default function ChecklistDetail({ checklistId, shareToken, onBack }: ChecklistDetailProps) {
  const { status } = useSession();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [userPermission, setUserPermission] = useState<'owner' | 'edit' | 'view'>('view');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);

  // Header more menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Edit metadata modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', dueDate: '', dueTime: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Save-as-template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateData, setTemplateData] = useState({ title: '', description: '', category: 'general', publish: false });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Group management
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteGroupName, setDeleteGroupName] = useState<string | null>(null);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'links' | 'people'>('links');
  const [shareLinks, setShareLinks] = useState<ChecklistShareLinkInfo[]>([]);
  const [shareMembers, setShareMembers] = useState<ChecklistMemberInfo[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLinkGenerating, setShareLinkGenerating] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const isOwner = userPermission === 'owner';
  const isEditable = userPermission === 'owner' || userPermission === 'edit';
  const isUnauthenticatedViewer = !!shareToken && status === 'unauthenticated';

  // Escape closes whichever modal is open
  useEscapeKey(showShareModal, () => setShowShareModal(false));
  useEscapeKey(showEditModal, () => setShowEditModal(false));
  useEscapeKey(showTemplateModal, () => setShowTemplateModal(false));

  useEffect(() => {
    const url = shareToken
      ? `/api/checklists?share=${shareToken}`
      : `/api/checklists?id=${checklistId}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setChecklist(data.checklist);
          if (data.userPermission) setUserPermission(data.userPermission);
          else if (data.checklist?.userPermission) setUserPermission(data.checklist.userPermission);
        }
      })
      .catch(() => setError('Failed to load checklist'))
      .finally(() => setIsLoading(false));
  }, [checklistId, shareToken]);

  const completedCount = checklist?.items.filter((i) => i.completed).length ?? 0;
  const totalCount = checklist?.items.length ?? 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Item handlers ────────────────────────────────────────────────────────────
  const handleToggle = async (id: string, completed: boolean) => {
    if (!checklist || !isEditable) return;
    const prev = checklist;
    setChecklist((c) => c ? { ...c, items: c.items.map((i) => (i.id === id ? { ...i, completed } : i)) } : null);
    const res = await fetch('/api/checklists/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checklistId: checklist.id, completed }),
    });
    if (!res.ok) setChecklist(prev);
  };

  const handleUpdateItem = async (id: string, fields: Partial<ChecklistItem>) => {
    if (!checklist || !isEditable) return;
    const prev = checklist;
    setChecklist((c) => c ? { ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) } : null);
    const res = await fetch('/api/checklists/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checklistId: checklist.id, ...fields }),
    });
    if (!res.ok) setChecklist(prev);
  };

  const handleDeleteItem = async (id: string) => {
    if (!checklist || !isEditable) return;
    const prev = checklist;
    setChecklist((c) => (c ? { ...c, items: c.items.filter((i) => i.id !== id) } : null));
    const res = await fetch(`/api/checklists/items?id=${id}&checklistId=${checklist.id}`, { method: 'DELETE' });
    if (!res.ok) setChecklist(prev);
  };

  // Inline "add item to a specific group" — keeps state local to the group block
  const [groupAddTitle, setGroupAddTitle] = useState<Record<string, string>>({});
  const handleAddItemToGroup = async (groupName: string) => {
    if (!checklist || !isEditable) return;
    const title = (groupAddTitle[groupName] ?? '').trim();
    if (!title) return;
    const res = await fetch('/api/checklists/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistId: checklist.id, title, groupName }),
    });
    const data = await res.json();
    if (data.item) {
      setChecklist((prev) => (prev ? { ...prev, items: [...prev.items, data.item] } : null));
      setGroupAddTitle((prev) => ({ ...prev, [groupName]: '' }));
    }
  };

  // ── Group handlers ───────────────────────────────────────────────────────────
  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name) {
      setShowNewGroupInput(false);
      return;
    }
    // Set as the default target for the next added items; group is only persisted
    // once at least one item with that groupName exists.
    setShowNewGroupInput(false);
    setNewGroupName('');
    addInputRef.current?.focus();
  };

  const handleRenameGroup = async (from: string) => {
    if (!checklist || !isEditable) return;
    const to = renameGroupValue.trim();
    setRenamingGroup(null);
    if (!to || to === from) return;
    setChecklist((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.groupName === from ? { ...i, groupName: to } : i)),
          }
        : null,
    );
    await fetch('/api/checklists/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistId: checklist.id, renameGroup: { from, to } }),
    });
  };

  const handleDeleteGroup = async (removeItems: boolean) => {
    if (!checklist || !deleteGroupName || !isEditable) return;
    const name = deleteGroupName;
    setDeleteGroupName(null);
    setChecklist((prev) => {
      if (!prev) return null;
      if (removeItems) {
        return { ...prev, items: prev.items.filter((i) => i.groupName !== name) };
      }
      return {
        ...prev,
        items: prev.items.map((i) => (i.groupName === name ? { ...i, groupName: '' } : i)),
      };
    });
    await fetch('/api/checklists/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistId: checklist.id, deleteGroup: { name, removeItems } }),
    });
  };

  const handleMoveGroup = async (groupName: string, direction: 'up' | 'down') => {
    if (!checklist || !isEditable) return;
    const groups = groupItems(checklist.items);
    if (!groups.some(g => g.groupName === '')) groups.unshift({ groupName: '', items: [] });
    const order = groups.map(g => g.groupName);
    const idx = order.indexOf(groupName);
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    const ordered = order
      .flatMap((g) => checklist.items.filter((i) => (i.groupName || '') === (g || '')))
      .map((item, i) => ({ ...item, order: i }));
    setChecklist((prev) => (prev ? { ...prev, items: ordered } : null));
    await fetch('/api/checklists/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklistId: checklist.id,
        items: ordered.map(({ id, order }) => ({ id, order })),
      }),
    });
  };

  // ── Metadata edit ───────────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!checklist) return;
    setEditData({
      title: checklist.title,
      description: checklist.description || '',
      dueDate: checklist.dueDate || '',
      dueTime: checklist.dueTime || '',
    });
    setShowEditModal(true);
    setShowMoreMenu(false);
  };
  const handleSaveEdit = async () => {
    if (!checklist || !editData.title.trim()) return;
    setEditSaving(true);
    try {
      await fetch('/api/checklists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: checklist.id,
          title: editData.title.trim(),
          description: editData.description,
          dueDate: editData.dueDate || null,
          dueTime: editData.dueTime || null,
        }),
      });
      setChecklist((prev) =>
        prev
          ? {
              ...prev,
              title: editData.title.trim(),
              description: editData.description,
              dueDate: editData.dueDate || null,
              dueTime: editData.dueTime || null,
            }
          : null,
      );
      setShowEditModal(false);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete checklist ────────────────────────────────────────────────────────
  const handleDeleteChecklist = async () => {
    if (!checklist) return;
    await fetch(`/api/checklists?id=${checklist.id}`, { method: 'DELETE' });
    setShowDeleteConfirm(false);
    onBack();
  };

  // ── Share modal ─────────────────────────────────────────────────────────────
  const openShareModal = async () => {
    if (!checklist) return;
    setShowShareModal(true);
    setShowMoreMenu(false);
    setShareLoading(true);
    try {
      const res = await fetch(`/api/checklists/members?checklistId=${checklist.id}`);
      const data = await res.json();
      setShareLinks(data.shareLinks ?? []);
      setShareMembers(data.members ?? []);
    } catch {
      /* ignore */
    } finally {
      setShareLoading(false);
    }
  };
  const handleGenerateLink = async (permission: 'view' | 'edit') => {
    if (!checklist) return;
    setShareLinkGenerating(permission);
    try {
      const res = await fetch('/api/checklists/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistId: checklist.id, permission }),
      });
      const data = await res.json();
      if (data.link) {
        setShareLinks((prev) => {
          const filtered = prev.filter((l) => !(l.permission === permission && l.isActive));
          return [...filtered, data.link];
        });
      }
    } finally {
      setShareLinkGenerating(null);
    }
  };
  const handleRevokeLink = async (linkId: string) => {
    await fetch(`/api/checklists/share?linkId=${linkId}`, { method: 'DELETE' });
    setShareLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, isActive: false } : l)));
    const link = shareLinks.find((l) => l.id === linkId);
    if (link) {
      setShareMembers((prev) => prev.filter((m) => m.permission !== link.permission));
    }
  };
  const handleRemoveMember = async (memberId: string) => {
    if (!checklist) return;
    await fetch(`/api/checklists/members?checklistId=${checklist.id}&memberId=${memberId}`, { method: 'DELETE' });
    setShareMembers((prev) => prev.filter((m) => m.id !== memberId));
  };
  const copyLink = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(linkId);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setShareCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  // ── Save as template ────────────────────────────────────────────────────────
  const openTemplateModal = () => {
    if (!checklist) return;
    setTemplateData({
      title: checklist.title,
      description: checklist.description || '',
      category: 'general',
      publish: false,
    });
    setTemplateSaved(false);
    setShowTemplateModal(true);
    setShowMoreMenu(false);
  };
  const handleSaveTemplate = async () => {
    if (!checklist || !templateData.title.trim()) return;
    setTemplateSaving(true);
    try {
      const res = await fetch('/api/checklists/templates/from-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId: checklist.id,
          title: templateData.title.trim(),
          description: templateData.description,
          category: templateData.category,
          publish: templateData.publish,
        }),
      });
      if (res.ok) setTemplateSaved(true);
    } finally {
      setTemplateSaving(false);
    }
  };

  // ── Derived UI data ─────────────────────────────────────────────────────────
  const dueDateInfo = useMemo(() => {
    if (!checklist?.dueDate) return null;
    const due = new Date(checklist.dueDate + (checklist.dueTime ? `T${checklist.dueTime}` : ''));
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)}d`, color: '#ef4444' };
    if (diffDays === 0) return { text: 'Due today', color: '#f97316' };
    if (diffDays === 1) return { text: 'Due tomorrow', color: '#f59e0b' };
    return { text: `Due in ${diffDays}d`, color: '#6b7280' };
  }, [checklist?.dueDate, checklist?.dueTime]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- checklist.items is the only field read; watching the whole `checklist` would re-run on unrelated metadata edits.
  const grouped = useMemo(() => (checklist ? groupItems(checklist.items) : []), [checklist?.items]);

  // Gated slice for unauthenticated viewers — show ~70% then a paywall card
  const visibleSlice = useMemo(() => {
    if (!checklist) return { groups: [], hiddenCount: 0 };
    if (!isUnauthenticatedViewer) return { groups: grouped, hiddenCount: 0 };
    const total = checklist.items.length;
    const limit = Math.max(1, Math.ceil(total * UNAUTH_VISIBLE_FRACTION));
    let remaining = limit;
    const out: { groupName: string; items: ChecklistItem[] }[] = [];
    for (const g of grouped) {
      if (remaining <= 0) break;
      const take = g.items.slice(0, remaining);
      out.push({ groupName: g.groupName, items: take });
      remaining -= take.length;
    }
    return { groups: out, hiddenCount: total - limit };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checklist.items is the only field read; watching the whole `checklist` would re-run on unrelated metadata edits.
  }, [grouped, isUnauthenticatedViewer, checklist?.items]);

  // Always ensure a "General" (empty groupName) group is present for editable views
  const displayGroups = useMemo(() => {
    if (!isEditable) return visibleSlice.groups;
    const groups = [...visibleSlice.groups];
    if (!groups.some(g => g.groupName === '')) {
      groups.unshift({ groupName: '', items: [] });
    }
    return groups;
  }, [visibleSlice.groups, isEditable]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="checklist-detail loading-state">
        <div className="loading-spinner" />
        <style jsx>{`
          .loading-state { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
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
          button { padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; background: var(--background); color: var(--foreground); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="checklist-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div className="header-actions">
          {isEditable && (
            <button className="header-btn" onClick={openEditModal} title="Edit">
              <Edit2 size={16} />
              <span className="header-btn-label">Edit</span>
            </button>
          )}
          {isEditable && (
            <div className="more-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                className={`header-btn ${showMoreMenu ? 'active' : ''}`}
                onClick={() => setShowMoreMenu((v) => !v)}
                title="More options"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMoreMenu && (
                <div className="more-menu">
                  {isOwner && (
                    <button onClick={openShareModal}>
                      <Share2 size={14} /> Sharing
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={openTemplateModal}>
                      <LayoutTemplate size={14} /> Save as template
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className="danger"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 size={14} /> Delete checklist
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showMoreMenu && <div className="menu-backdrop" onClick={() => setShowMoreMenu(false)} />}

      {/* Permission/share banners */}
      {!isOwner && shareToken && status === 'authenticated' && (
        <div className={`perm-banner perm-${userPermission}`}>
          <Share2 size={14} />
          {userPermission === 'edit'
            ? 'Shared with you — you can edit'
            : 'Shared with you — view only'}
        </div>
      )}
      {isUnauthenticatedViewer && (
        <div className="perm-banner perm-preview">
          <Lock size={14} />
          Preview mode — sign in to see the full checklist
        </div>
      )}

      {/* Title + meta */}
      <div className="detail-meta">
        <h1 className="detail-title">{checklist.title}</h1>
        {checklist.description && <p className="detail-desc">{checklist.description}</p>}
        <div className="detail-badges">
          {dueDateInfo && (
            <span className="due-badge" style={{ color: dueDateInfo.color }}>
              {dueDateInfo.text}
            </span>
          )}
          {checklist.planId && <span className="plan-badge">Linked to plan</span>}
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="progress-section">
          <div className="progress-label">
            <span>
              {completedCount} of {totalCount} completed
            </span>
            <span className="progress-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Items by group */}
      <div className="items-section">
        {(isEditable ? displayGroups : visibleSlice.groups).map(({ groupName, items }, groupIndex) => {
          const isGeneral = groupName === '';
          const displayName = isGeneral ? 'General' : groupName;
          const addTitle = groupAddTitle[groupName] ?? '';
          const allGroups = isEditable ? displayGroups : visibleSlice.groups;
          const isFirst = groupIndex === 0;
          const isLast = groupIndex === allGroups.length - 1;
          return (
            <div key={groupName || '__general'} className="item-group">
              <div className="group-header">
                {renamingGroup === groupName ? (
                  <input
                    className="group-rename-input"
                    autoFocus
                    value={renameGroupValue}
                    onChange={(e) => setRenameGroupValue(e.target.value)}
                    onBlur={() => handleRenameGroup(groupName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameGroup(groupName);
                      if (e.key === 'Escape') setRenamingGroup(null);
                    }}
                  />
                ) : (
                  <span className="group-name">{displayName}</span>
                )}
                <span className="group-count">
                  {items.filter((i) => i.completed).length}/{items.length}
                </span>
                {isEditable && renamingGroup !== groupName && (
                  <div className="group-actions">
                    {!isFirst && (
                      <button className="group-action" title="Move up" onClick={() => handleMoveGroup(groupName, 'up')}>
                        <ChevronUp size={12} />
                      </button>
                    )}
                    {!isLast && (
                      <button className="group-action" title="Move down" onClick={() => handleMoveGroup(groupName, 'down')}>
                        <ChevronDown size={12} />
                      </button>
                    )}
                    {!isGeneral && (
                      <button
                        className="group-action"
                        title="Rename group"
                        onClick={() => { setRenamingGroup(groupName); setRenameGroupValue(groupName); }}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {!isGeneral && (
                      <button className="group-action danger" title="Delete group" onClick={() => setDeleteGroupName(groupName)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  isOwner={isEditable}
                  onToggle={handleToggle}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                />
              ))}

              {/* Per-group dotted add row */}
              {isEditable && (
                <div className="group-add-row">
                  <Plus size={14} className="group-add-icon" />
                  <input
                    className="group-add-input"
                    placeholder={`Add to ${displayName}…`}
                    value={addTitle}
                    onChange={(e) => setGroupAddTitle((prev) => ({ ...prev, [groupName]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItemToGroup(groupName); }}
                  />
                  {addTitle && (
                    <button className="group-add-btn" onClick={() => handleAddItemToGroup(groupName)}>
                      Add
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Gated view CTA */}
        {isUnauthenticatedViewer && visibleSlice.hiddenCount > 0 && (
          <div className="paywall-card">
            <Lock size={28} />
            <h3>{visibleSlice.hiddenCount} more items hidden</h3>
            <p>Sign in to see the full checklist and collaborate.</p>
            <button className="paywall-cta" onClick={() => signIn('google')}>
              Sign in to continue
            </button>
          </div>
        )}

        {/* Add new named group */}
        {isEditable && (
          showNewGroupInput ? (
            <div className="add-group-row">
              <FolderPlus size={14} />
              <input
                className="add-group-input"
                placeholder="Group name…"
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onBlur={handleAddGroup}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddGroup();
                  if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                }}
              />
            </div>
          ) : (
            <button className="new-group-btn" onClick={() => setShowNewGroupInput(true)}>
              <FolderPlus size={14} />
              Add group
            </button>
          )
        )}
      </div>

      {/* ── Edit metadata modal ─────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Edit checklist" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Edit checklist</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Title</span>
                <input
                  value={editData.title}
                  onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Checklist title"
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Due date</span>
                  <input
                    type="date"
                    value={editData.dueDate}
                    onChange={(e) => setEditData((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Due time</span>
                  <input
                    type="time"
                    value={editData.dueTime}
                    onChange={(e) => setEditData((d) => ({ ...d, dueTime: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveEdit}
                disabled={!editData.title.trim() || editSaving}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as template modal ──────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Save as template" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Save as template</h3>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {templateSaved ? (
                <div className="template-success">
                  <Check size={28} />
                  <p>Template saved{templateData.publish ? ' and published' : ''}.</p>
                </div>
              ) : (
                <>
                  <label className="field">
                    <span>Template title</span>
                    <input
                      value={templateData.title}
                      onChange={(e) => setTemplateData((d) => ({ ...d, title: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      value={templateData.description}
                      onChange={(e) =>
                        setTemplateData((d) => ({ ...d, description: e.target.value }))
                      }
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      value={templateData.category}
                      onChange={(e) =>
                        setTemplateData((d) => ({ ...d, category: e.target.value }))
                      }
                    >
                      <option value="general">General</option>
                      <option value="travel">Travel</option>
                      <option value="event">Event</option>
                      <option value="work">Work</option>
                      <option value="home">Home</option>
                      <option value="health">Health</option>
                      <option value="shopping">Shopping</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={templateData.publish}
                      onChange={(e) =>
                        setTemplateData((d) => ({ ...d, publish: e.target.checked }))
                      }
                    />
                    <span>Publish to community templates</span>
                  </label>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowTemplateModal(false)}>
                {templateSaved ? 'Close' : 'Cancel'}
              </button>
              {!templateSaved && (
                <button
                  className="btn-primary"
                  onClick={handleSaveTemplate}
                  disabled={!templateData.title.trim() || templateSaving}
                >
                  {templateSaving ? 'Saving…' : 'Save template'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Share modal ─────────────────────────────────────────────────────── */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-card share-modal" role="dialog" aria-modal="true" aria-label="Sharing" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Sharing</h3>
              <button className="modal-close" onClick={() => setShowShareModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="share-tabs">
              <button
                className={`share-tab ${shareModalTab === 'links' ? 'active' : ''}`}
                onClick={() => setShareModalTab('links')}
              >
                <Link2 size={14} />
                Share links
              </button>
              <button
                className={`share-tab ${shareModalTab === 'people' ? 'active' : ''}`}
                onClick={() => setShareModalTab('people')}
              >
                <Users size={14} />
                People with access
                {shareMembers.length > 0 && (
                  <span className="share-tab-count">{shareMembers.length}</span>
                )}
              </button>
            </div>

            <div className="modal-body">
              {shareLoading ? (
                <div className="share-loading">Loading…</div>
              ) : shareModalTab === 'links' ? (
                <>
                  {(['view', 'edit'] as const).map((perm) => {
                    const existing = shareLinks.find((l) => l.permission === perm && l.isActive);
                    const url = existing
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?cshare=${existing.token}`
                      : '';
                    return (
                      <div key={perm} className="share-section">
                        <div className="share-section-title">
                          <span className={`share-perm-badge ${perm}`}>
                            {perm === 'view' ? '👁 View only' : '✏️ Can edit'}
                          </span>
                          <span className="share-section-hint">
                            {perm === 'view'
                              ? 'Recipients can view but not edit'
                              : 'Recipients can check items, add and edit them'}
                          </span>
                        </div>
                        {existing ? (
                          <div className="share-link-row">
                            <div className="share-link-url">{url}</div>
                            <button
                              className="share-action-btn copy"
                              onClick={() => copyLink(url, existing.id)}
                            >
                              {shareCopied === existing.id ? <Check size={14} /> : <Copy size={14} />}
                              {shareCopied === existing.id ? 'Copied' : 'Copy'}
                            </button>
                            <button
                              className="share-action-btn revoke"
                              onClick={() => handleRevokeLink(existing.id)}
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <button
                            className="share-generate-btn"
                            onClick={() => handleGenerateLink(perm)}
                            disabled={shareLinkGenerating === perm}
                          >
                            <Link2 size={14} />
                            {shareLinkGenerating === perm
                              ? 'Generating…'
                              : `Generate ${perm} link`}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <div className="share-section template-cta">
                    <div className="share-section-title">
                      <span className="share-perm-badge template">📋 As template</span>
                      <span className="share-section-hint">
                        Share the structure of this checklist with the community
                      </span>
                    </div>
                    <button className="share-generate-btn" onClick={openTemplateModal}>
                      <LayoutTemplate size={14} />
                      Save as template
                    </button>
                  </div>
                </>
              ) : (
                <div className="share-members">
                  {shareMembers.length === 0 ? (
                    <div className="share-empty">
                      <Users size={32} />
                      <p>No one has accessed this checklist yet.</p>
                      <p className="share-empty-hint">
                        Generate a share link and send it to collaborators.
                      </p>
                    </div>
                  ) : (
                    shareMembers.map((member) => {
                      const displayName = member.userName || member.userEmail || 'Unknown user';
                      const displayEmail = member.userEmail || null;
                      return (
                        <div key={member.id} className="share-member-row">
                          <div className="share-member-avatar">
                            {displayName[0].toUpperCase()}
                          </div>
                          <div className="share-member-info">
                            <span className="share-member-name">{displayName}</span>
                            {displayEmail && displayEmail !== displayName && (
                              <span className="share-member-email">{displayEmail}</span>
                            )}
                          </div>
                          <span className={`share-perm-badge ${member.permission}`}>
                            {member.permission === 'edit' ? '✏️ Edit' : '👁 View'}
                          </span>
                          <button
                            className="share-remove-btn"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove access"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete checklist confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Checklist"
        message="This will permanently delete the checklist and all its items. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteChecklist}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Delete group confirm */}
      <ConfirmDialog
        open={!!deleteGroupName}
        title={`Delete "${deleteGroupName}" group?`}
        message="You can keep the items (move them to ungrouped) or delete them all."
        confirmLabel="Keep items"
        cancelLabel="Cancel"
        onConfirm={() => handleDeleteGroup(false)}
        onCancel={() => setDeleteGroupName(null)}
        extraAction={{ label: 'Delete items too', danger: true, onClick: () => handleDeleteGroup(true) }}
      />

      <style jsx>{`
        .checklist-detail {
          max-width: 680px;
          margin: 0 auto;
          padding: 20px 16px 80px;
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          position: relative;
        }
        .back-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          color: var(--muted-foreground, #6b7280);
          font-size: 14px; padding: 6px 0;
        }
        .back-btn:hover { color: var(--foreground); }
        .header-actions { display: flex; gap: 8px; align-items: center; }
        .header-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background, white);
          cursor: pointer; font-size: 13px;
          color: var(--foreground);
        }
        .header-btn:hover, .header-btn.active { background: var(--muted, #f3f4f6); }
        .header-btn-label { display: inline; }
        @media (max-width: 480px) {
          .header-btn-label { display: none; }
        }
        .more-wrap { position: relative; }
        .more-menu {
          position: absolute; right: 0; top: calc(100% + 4px);
          background: var(--background, white);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          z-index: 200;
          min-width: 200px;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .more-menu button {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 12px;
          background: none; border: none; cursor: pointer;
          font-size: 13px; color: var(--foreground);
          text-align: left;
        }
        .more-menu button:hover { background: var(--muted, #f3f4f6); }
        .more-menu button.danger { color: #ef4444; }
        .menu-backdrop { position: fixed; inset: 0; z-index: 190; }

        .perm-banner {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
        }
        .perm-edit { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
        .perm-view { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
        .perm-preview { background: #fefce8; border: 1px solid #fde68a; color: #a16207; }

        .detail-meta { margin-bottom: 20px; }
        .detail-title {
          font-size: 24px; font-weight: 700;
          color: var(--foreground); margin: 0 0 6px;
        }
        .detail-desc { font-size: 14px; color: var(--muted-foreground); margin: 0 0 10px; white-space: pre-wrap; }
        .detail-badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .due-badge {
          font-size: 12px; font-weight: 500;
          padding: 2px 8px; border-radius: 10px;
          background: var(--muted, #f3f4f6);
        }
        .plan-badge {
          font-size: 12px; padding: 2px 8px; border-radius: 10px;
          background: #eff6ff; color: #1d4ed8;
        }
        .meta-edit-btn {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; padding: 2px 8px; border-radius: 10px;
          border: 1px dashed var(--border); background: transparent;
          color: var(--muted-foreground); cursor: pointer;
        }
        .meta-edit-btn:hover { background: var(--muted); color: var(--foreground); }

        .progress-section { margin-bottom: 24px; }
        .progress-label {
          display: flex; justify-content: space-between;
          font-size: 13px; color: var(--muted-foreground);
          margin-bottom: 6px;
        }
        .progress-pct { font-weight: 600; color: var(--primary, #6366f1); }
        .progress-track {
          height: 8px; background: var(--muted, #e5e7eb);
          border-radius: 99px; overflow: hidden;
        }
        .progress-fill {
          height: 100%; background: var(--primary, #6366f1);
          border-radius: 99px; transition: width 0.3s ease;
        }

        .items-section { display: flex; flex-direction: column; gap: 2px; }
        .item-group { margin-top: 16px; }
        .item-group.ungrouped { margin-top: 0; }
        .group-header {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 4px; margin-bottom: 4px;
        }
        .group-name {
          font-size: 13px; font-weight: 600; color: var(--foreground);
          text-transform: uppercase; letter-spacing: 0.05em;
          flex: 1;
        }
        .group-rename-input {
          flex: 1; font-size: 13px; font-weight: 600;
          padding: 2px 6px; border-radius: 4px;
          border: 1px solid var(--primary, #6366f1);
          background: var(--background, white);
          color: var(--foreground); outline: none;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .group-count { font-size: 12px; color: var(--muted-foreground); }
        .group-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
        .item-group:hover .group-actions { opacity: 1; }
        .group-action {
          background: none; border: none; cursor: pointer;
          padding: 2px 4px; color: var(--muted-foreground);
          border-radius: 4px;
        }
        .group-action:hover { background: var(--muted); color: var(--foreground); }
        .group-action.danger:hover { color: #ef4444; }

        .group-add-row {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; margin-top: 4px;
          border-radius: 6px;
        }
        .group-add-icon { color: var(--muted-foreground); }
        .group-add-input {
          flex: 1; border: none; outline: none;
          background: transparent; font-size: 13px;
          color: var(--foreground);
          border-bottom: 1px dashed var(--border, #e5e7eb);
          padding: 2px 0;
        }
        .group-add-input:focus { border-bottom-color: var(--primary, #6366f1); }
        .group-add-btn {
          padding: 4px 12px;
          border-radius: 6px;
          background: var(--primary, #6366f1);
          color: white; border: none; cursor: pointer;
          font-size: 12px; font-weight: 500;
          white-space: nowrap;
        }
        .group-add-btn:hover { opacity: 0.9; }

        .paywall-card {
          margin: 24px 0; padding: 24px;
          border: 1px dashed var(--border, #e5e7eb);
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05));
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; text-align: center;
          color: var(--foreground);
        }
        .paywall-card h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .paywall-card p { margin: 0; font-size: 13px; color: var(--muted-foreground); }
        .paywall-cta {
          margin-top: 8px; padding: 10px 22px;
          border-radius: 99px; border: none;
          background: var(--primary, #6366f1); color: white;
          font-weight: 600; font-size: 13px; cursor: pointer;
        }
        .paywall-cta:hover { opacity: 0.9; }

        .empty-items { text-align: center; padding: 32px 0; color: var(--muted-foreground); font-size: 14px; }

        .new-group-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 16px;
          padding: 6px 12px;
          border-radius: 99px;
          border: 1px dashed var(--border, #e5e7eb);
          background: transparent;
          color: var(--muted-foreground);
          font-size: 12px; cursor: pointer;
          align-self: flex-start; width: fit-content;
        }
        .new-group-btn:hover { color: var(--primary, #6366f1); border-color: var(--primary, #6366f1); }

        .add-group-row {
          display: flex; align-items: center; gap: 8px;
          margin-top: 16px;
          padding: 8px 12px;
          border: 1px solid var(--primary, #6366f1);
          border-radius: 8px;
          background: var(--background, white);
        }
        .add-group-input {
          flex: 1; border: none; outline: none;
          background: transparent; font-size: 13px;
          color: var(--foreground);
        }

        .add-item-row {
          display: flex; align-items: center; gap: 8px;
          margin-top: 16px; padding-top: 12px;
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
          color: white; border: none; cursor: pointer;
          font-size: 13px; font-weight: 500;
          white-space: nowrap;
        }
        .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .add-btn:hover:not(:disabled) { opacity: 0.9; }

        /* ── Modal shell ───────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 300; padding: 16px;
        }
        .modal-card {
          background: var(--background, white);
          border-radius: 16px;
          max-width: 520px; width: 100%;
          /* dvh so the modal shrinks with the iOS keyboard; safe-area top +
             bottom keeps content clear of notch and home indicator. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px);
          overflow: hidden;
          display: flex; flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .modal-card.share-modal { max-width: 560px; }
        .modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .modal-head h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--foreground); }
        .modal-close {
          background: none; border: none; cursor: pointer;
          color: var(--muted-foreground); padding: 4px;
          border-radius: 6px;
        }
        .modal-close:hover { background: var(--muted); }
        .modal-body {
          flex: 1 1 auto;
          min-height: 0;
          padding: 16px 20px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; gap: 14px;
        }
        .modal-footer {
          flex-shrink: 0;
          display: flex; gap: 8px; justify-content: flex-end;
          padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border, #e5e7eb);
          background: var(--background, white);
        }
        .btn-primary {
          padding: 8px 18px; border-radius: 8px; border: none;
          background: var(--primary, #6366f1); color: white;
          font-weight: 500; font-size: 13px; cursor: pointer;
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .btn-ghost {
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background); color: var(--foreground);
          font-size: 13px; cursor: pointer;
        }
        .btn-ghost:hover { background: var(--muted); }

        .field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--foreground); }
        .field > span { font-weight: 500; color: var(--muted-foreground); font-size: 12px; }
        .field input, .field textarea, .field select {
          padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background); color: var(--foreground);
          font-size: 14px; outline: none;
          font-family: inherit;
        }
        .field input:focus, .field textarea:focus, .field select:focus {
          border-color: var(--primary, #6366f1);
        }
        .field-row { display: flex; gap: 12px; }
        .field-row .field { flex: 1; }
        .checkbox-field { flex-direction: row; align-items: center; gap: 8px; }
        .checkbox-field input { width: 16px; height: 16px; }
        .checkbox-field span { font-weight: normal; color: var(--foreground); }

        .template-success {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 16px;
          color: #047857;
        }

        /* ── Share modal pieces ─────────────────────────────────────────── */
        .share-tabs {
          display: flex; padding: 0 20px;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .share-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px;
          background: none; border: none; cursor: pointer;
          color: var(--muted-foreground); font-size: 13px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .share-tab.active { color: var(--primary, #6366f1); border-bottom-color: var(--primary, #6366f1); }
        .share-tab-count {
          background: var(--primary, #6366f1); color: white;
          font-size: 11px; padding: 1px 6px; border-radius: 99px;
          font-weight: 600;
        }
        .share-loading { padding: 24px; text-align: center; color: var(--muted-foreground); }
        .share-section {
          padding: 12px; border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .share-section.template-cta { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-color: #a7f3d0; }
        .share-section-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .share-section-hint { font-size: 12px; color: var(--muted-foreground); }
        .share-perm-badge {
          font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500;
        }
        .share-perm-badge.view { background: #eff6ff; color: #1d4ed8; }
        .share-perm-badge.edit { background: #ecfdf5; color: #047857; }
        .share-perm-badge.template { background: #f5f3ff; color: #6d28d9; }
        .share-link-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .share-link-url {
          flex: 1; min-width: 0;
          font-size: 12px; color: var(--muted-foreground);
          word-break: break-all;
          background: var(--muted, #f9fafb);
          padding: 6px 10px; border-radius: 6px;
        }
        .share-action-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 6px 10px; border-radius: 6px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--background, white);
          font-size: 12px; cursor: pointer;
        }
        .share-action-btn.copy { color: var(--foreground); }
        .share-action-btn.revoke { color: #ef4444; }
        .share-action-btn:hover { background: var(--muted, #f3f4f6); }
        .share-generate-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px;
          border: 1px dashed var(--border, #e5e7eb);
          background: var(--background, white);
          color: var(--primary, #6366f1); cursor: pointer;
          font-size: 13px; font-weight: 500;
          align-self: flex-start;
        }
        .share-generate-btn:hover:not(:disabled) { background: var(--muted, #f3f4f6); }
        .share-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .share-members { display: flex; flex-direction: column; gap: 8px; }
        .share-empty {
          padding: 24px; text-align: center;
          color: var(--muted-foreground);
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .share-empty-hint { font-size: 12px; }
        .share-member-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
        }
        .share-member-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; font-weight: 600; font-size: 13px;
        }
        .share-member-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .share-member-name { font-size: 13px; font-weight: 500; color: var(--foreground); }
        .share-member-email { font-size: 11px; color: var(--muted-foreground); }
        .share-remove-btn {
          background: none; border: none; cursor: pointer;
          color: var(--muted-foreground); padding: 4px;
          border-radius: 4px;
        }
        .share-remove-btn:hover { background: #fef2f2; color: #ef4444; }
      `}</style>
    </div>
  );
}
