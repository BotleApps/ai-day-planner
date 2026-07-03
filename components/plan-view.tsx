'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Plan, DayPlan, Activity, ACTIVITY_COLORS, ACTIVITY_ICONS } from '@/lib/types';
import { formatDate, calculateDayProgress, formatDuration } from '@/lib/utils';
import Timeline, { ActivityDetailPopup } from '@/components/timeline';
import AIPanel from '@/components/ai-panel';
import ActivityModal from '@/components/activity-modal';
import ConfirmDialog from '@/components/confirm-dialog';
import { useEscapeKey } from '@/lib/use-escape-key';
import {
  Plus,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle2,
  X,
  Copy,
  Check,
  Link2,
  AlignLeft,
  LayoutList,
  StickyNote,
  MapPin,
  Calendar,
  MoreHorizontal,
  Edit2,
  Users,
  Lock,
} from 'lucide-react';

interface PlanViewProps {
  planId: string;
  shareToken?: string;
  onBack?: () => void;
}

export function PlanView({ planId, shareToken, onBack }: PlanViewProps) {
  const { status: sessionStatus } = useSession();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [newActivityTime, setNewActivityTime] = useState('09:00');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'links' | 'people'>('links');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userPermission, setUserPermission] = useState<'owner' | 'edit' | 'view'>('owner');

  // View mode: 'timeline' | 'text' — persisted in localStorage
  const [viewMode, setViewMode] = useState<'timeline' | 'text'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('planViewMode') as 'timeline' | 'text') || 'timeline';
    }
    return 'timeline';
  });
  const switchViewMode = (mode: 'timeline' | 'text') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('planViewMode', mode);
  };

  // Day notes
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Confirm dialog for plan delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [editPlanData, setEditPlanData] = useState({
    title: '',
    destination: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [editPlanSaving, setEditPlanSaving] = useState(false);

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const daysScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [isDetailPopupOpen, setIsDetailPopupOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null);

  const initialDaySetRef = useRef(false);

  // Reset initial-day tracking when the plan changes (e.g. user navigates to a different plan)
  useEffect(() => {
    initialDaySetRef.current = false;
    setSelectedDayId('');
  }, [planId, shareToken]);

  // Fetch plan
  const fetchPlan = useCallback(async () => {
    try {
      const url = shareToken
        ? `/api/plans?share=${shareToken}`
        : `/api/plans?id=${planId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
        if (data.userPermission) setUserPermission(data.userPermission);
        if (!initialDaySetRef.current && data.plan.days.length > 0) {
          // Select today's day or first day — only on initial load
          const today = new Date().toISOString().split('T')[0];
          const todayDay = data.plan.days.find((d: DayPlan) => d.date === today);
          setSelectedDayId(todayDay?.id || data.plan.days[0].id);
          initialDaySetRef.current = true;
        }
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [planId, shareToken]); // selectedDayId intentionally excluded — initial selection tracked via ref

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Scroll timeline to current time on initial load
  useEffect(() => {
    if (!plan || !timelineScrollRef.current) return;
    const now = new Date();
    const HOUR_HEIGHT = 80;
    const START_HOUR = 6;
    const currentMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
    if (currentMinutes > 0) {
      const scrollPos = Math.max(0, (currentMinutes / 60) * HOUR_HEIGHT - 120);
      timelineScrollRef.current.scrollTop = scrollPos;
    }
  }, [plan]);

  // Auto-scroll day strip to keep selected pill centered
  useEffect(() => {
    if (!daysScrollRef.current || !plan) return;
    const container = daysScrollRef.current;
    const index = plan.days.findIndex(d => d.id === selectedDayId);
    const pill = container.children[index] as HTMLElement | undefined;
    if (!pill) return;
    const containerW = container.offsetWidth;
    const pillLeft = pill.offsetLeft;
    const pillW = pill.offsetWidth;
    container.scrollTo({ left: pillLeft - (containerW - pillW) / 2, behavior: 'smooth' });
  }, [selectedDayId, plan]);

  const selectedDay = plan?.days.find(d => d.id === selectedDayId);
  const selectedDayIndex = plan?.days.findIndex(d => d.id === selectedDayId) ?? 0;

  // Unauthenticated viewers of shared plans see only ~70% of activities, then a paywall card.
  const isUnauthenticatedViewer = !!shareToken && sessionStatus === 'unauthenticated';
  const previewSlice = useMemo(() => {
    if (!selectedDay || !isUnauthenticatedViewer) {
      return { day: selectedDay, hiddenCount: 0 };
    }
    const total = selectedDay.activities.length;
    if (total === 0) return { day: selectedDay, hiddenCount: 0 };
    const visible = Math.max(1, Math.ceil(total * 0.7));
    if (visible >= total) return { day: selectedDay, hiddenCount: 0 };
    const sliced = [...selectedDay.activities]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, visible);
    return { day: { ...selectedDay, activities: sliced }, hiddenCount: total - visible };
  }, [selectedDay, isUnauthenticatedViewer]);
  const displayDay = previewSlice.day;

  // Sync notes textarea when selected day changes
  useEffect(() => {
    setNotesValue(selectedDay?.notes ?? '');
  }, [selectedDayId, selectedDay?.notes]);

  // Handle adding activity
  const handleAddActivity = useCallback((startTime: string) => {
    setNewActivityTime(startTime);
    setEditingActivity(null);
    setShowActivityModal(true);
  }, []);

  // Handle editing activity
  const handleEditActivity = useCallback((activity: Activity) => {
    setEditingActivity(activity);
    setNewActivityTime(activity.startTime);
    setShowActivityModal(true);
  }, []);

  // Share modal state — new two-link system
  const [shareLinks, setShareLinks] = useState<Array<{id: string; token: string; permission: string; isActive: boolean}>>([]);
  const [shareMembers, setShareMembers] = useState<Array<{id: string; userId: string; userEmail: string; userName: string; permission: string}>>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLinkGenerating, setShareLinkGenerating] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Escape closes whichever modal is open
  useEscapeKey(showShareModal, () => setShowShareModal(false));
  useEscapeKey(showSettingsModal, () => setShowSettingsModal(false));
  useEscapeKey(showActivityModal, () => setShowActivityModal(false));
  useEscapeKey(showEditPlanModal, () => setShowEditPlanModal(false));
  useEscapeKey(showDayPicker, () => setShowDayPicker(false));

  const openShareModal = async () => {
    setShowShareModal(true);
    if (!plan) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/plans/members?planId=${plan._id}`);
      const data = await res.json();
      setShareLinks(data.shareLinks ?? []);
      setShareMembers(data.members ?? []);
    } catch { /* ignore */ }
    finally { setShareLoading(false); }
  };

  const handleGenerateLink = async (permission: 'view' | 'edit') => {
    if (!plan) return;
    setShareLinkGenerating(permission);
    try {
      const res = await fetch('/api/plans/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan._id, permission }),
      });
      const data = await res.json();
      if (data.link) {
        setShareLinks(prev => {
          const filtered = prev.filter(l => !(l.permission === permission && l.isActive));
          return [...filtered, data.link];
        });
      }
    } catch { /* ignore */ }
    finally { setShareLinkGenerating(null); }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await fetch(`/api/plans/share?linkId=${linkId}`, { method: 'DELETE' });
      setShareLinks(prev => prev.map(l => l.id === linkId ? { ...l, isActive: false } : l));
      setShareMembers(prev => prev.filter(m => {
        const link = shareLinks.find(l => l.id === linkId);
        return !link || m.permission !== link.permission;
      }));
    } catch { /* ignore */ }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!plan) return;
    try {
      await fetch(`/api/plans/members?planId=${plan._id}&memberId=${memberId}`, { method: 'DELETE' });
      setShareMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { /* ignore */ }
  };

  const copyLink = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(linkId);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setShareCopied(null), 2000);
    } catch { /* ignore */ }
  };

  // Save activity
  const handleSaveActivity = async (activity: Activity) => {
    if (!plan || !selectedDayId) return;

    try {
      let res: Response;
      if (editingActivity) {
        res = await fetch('/api/activities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan._id, dayId: selectedDayId, activityId: activity.id, updates: activity }),
        });
      } else {
        res = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan._id, dayId: selectedDayId, activity }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Error saving activity:', body.error ?? res.status);
        return;
      }
      fetchPlan();
    } catch (error) {
      console.error('Error saving activity:', error);
    }
  };

  // Update activity
  const handleActivityUpdate = async (activity: Activity) => {
    if (!plan || !selectedDayId) return;

    try {
      const res = await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan._id, dayId: selectedDayId, activityId: activity.id, updates: activity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Error updating activity:', body.error ?? res.status);
        return;
      }
      fetchPlan();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  // Delete activity
  const handleActivityDelete = async (activityId: string) => {
    if (!plan || !selectedDayId) return;

    try {
      const res = await fetch(`/api/activities?planId=${plan._id}&dayId=${selectedDayId}&activityId=${activityId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Error deleting activity:', body.error ?? res.status);
        return;
      }
      fetchPlan();
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  // Reorder activities
  const handleActivityReorder = async (sourceIndex: number, destIndex: number) => {
    if (!plan || !selectedDay) return;

    const newActivities = Array.from(selectedDay.activities);
    const [removed] = newActivities.splice(sourceIndex, 1);
    newActivities.splice(destIndex, 0, removed);

    try {
      const res = await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan._id, dayId: selectedDayId, activities: newActivities }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Error reordering activities:', body.error ?? res.status);
        return;
      }
      fetchPlan();
    } catch (error) {
      console.error('Error reordering activities:', error);
    }
  };

  // Save day notes
  const handleSaveNotes = async (notes: string) => {
    if (!plan || !selectedDayId) return;
    setNotesSaving(true);
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan._id,
          dayId: selectedDayId,
          notes,
        }),
      });
      await fetchPlan();
      setShowNotesPanel(false);
    } finally {
      setNotesSaving(false);
    }
  };

  // Delete plan
  const handleDeletePlan = async () => {
    await fetch(`/api/plans?id=${plan!._id}`, { method: 'DELETE' });
    setShowDeleteConfirm(false);
    setShowSettingsModal(false);
    if (onBack) onBack();
  };

  // Open edit plan modal — pre-populate with current plan values
  const openEditPlanModal = () => {
    setEditPlanData({
      title: plan!.title,
      destination: plan!.destination || '',
      description: plan!.description || '',
      startDate: plan!.startDate,
      endDate: plan!.endDate,
    });
    setShowMoreMenu(false);
    setShowSettingsModal(false);
    setShowEditPlanModal(true);
  };

  // Save edited plan details
  const handleSaveEditPlan = async () => {
    if (!plan || !editPlanData.title.trim() || !editPlanData.startDate || !editPlanData.endDate) return;
    setEditPlanSaving(true);
    try {
      await fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan._id, ...editPlanData }),
      });
      setShowEditPlanModal(false);
      fetchPlan();
    } finally {
      setEditPlanSaving(false);
    }
  };

  // Replace all activities (from AI)
  const handleReplaceActivities = async (activities: Activity[]) => {
    if (!plan || !selectedDayId) return;

    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan._id,
          dayId: selectedDayId,
          activities,
        }),
      });
      fetchPlan();
      setShowAIPanel(false);
    } catch (error) {
      console.error('Error replacing activities:', error);
    }
  };

  // Navigate days
  const goToDay = (direction: 'prev' | 'next') => {
    if (!plan) return;
    const newIndex = direction === 'prev' ? selectedDayIndex - 1 : selectedDayIndex + 1;
    if (newIndex >= 0 && newIndex < plan.days.length) {
      setSelectedDayId(plan.days[newIndex].id);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading your plan...</p>
        <style jsx>{`
          .loading-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            color: var(--muted-foreground);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="error-container">
        <p>Plan not found</p>
        <style jsx>{`
          .error-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--muted-foreground);
          }
        `}</style>
      </div>
    );
  }

  const progress = selectedDay ? calculateDayProgress(selectedDay) : { total: 0, completed: 0, percentage: 0 };
  const today = new Date().toISOString().split('T')[0];
  const isEditable = userPermission !== 'view';

  return (
    <div className="plan-view">
      {/* Sticky top block: header + day strip + progress */}
      <div className="sticky-top">
        {/* Compact Header */}
        <header className="plan-header">
          <button onClick={onBack} className="back-btn" aria-label="Back to plans">
            <ChevronLeft size={20} />
          </button>

          <div className="header-center">
            <h1>{plan.title}</h1>
            {plan.destination && (
              <span className="destination">
                <MapPin size={12} />
                {plan.destination}
              </span>
            )}
          </div>

          <div className="header-actions">
            {/* View mode toggle — single tap to switch */}
            <div className="view-toggle-wrap">
              <button
                className="btn-icon"
                onClick={() => switchViewMode(viewMode === 'timeline' ? 'text' : 'timeline')}
                title={viewMode === 'timeline' ? 'Switch to List view' : 'Switch to Timeline view'}
              >
                {viewMode === 'timeline' ? <AlignLeft size={17} /> : <LayoutList size={17} />}
              </button>
            </div>

            {/* Desktop: individual buttons */}
            <div className="header-actions-desktop">
              <button
                className={`btn-icon ${showNotesPanel ? 'active' : ''}`}
                title="Day notes"
                onClick={() => setShowNotesPanel(v => !v)}
              >
                <StickyNote size={17} />
              </button>
              {userPermission === 'owner' && (
                <button className="btn-icon" title="Sharing" onClick={openShareModal}>
                  <Share2 size={17} />
                </button>
              )}
              <button className="btn-icon" title="Settings" onClick={() => setShowSettingsModal(true)}>
                <Settings size={17} />
              </button>
            </div>

            {/* Mobile: overflow menu */}
            <div className="header-more-wrap" onClick={e => e.stopPropagation()}>
              <button
                className={`btn-icon ${showMoreMenu ? 'active' : ''}`}
                onClick={() => setShowMoreMenu(v => !v)}
                title="More options"
                aria-label="More options"
                aria-expanded={showMoreMenu}
              >
                <MoreHorizontal size={17} />
              </button>
              {showMoreMenu && (
                <div className="more-menu">
                  <button
                    className={`more-menu-item ${showNotesPanel ? 'active-item' : ''}`}
                    onClick={() => { setShowNotesPanel(v => !v); setShowMoreMenu(false); }}
                  >
                    <StickyNote size={16} />
                    Day Notes
                  </button>
                  {userPermission === 'owner' && (
                    <button
                      className="more-menu-item"
                      onClick={() => { openShareModal(); setShowMoreMenu(false); }}
                    >
                      <Share2 size={16} />
                      Sharing
                    </button>
                  )}
                  {isEditable && (
                    <button
                      className="more-menu-item"
                      onClick={openEditPlanModal}
                    >
                      <Edit2 size={16} />
                      Edit Plan
                    </button>
                  )}
                  <button
                    className="more-menu-item"
                    onClick={() => { setShowSettingsModal(true); setShowMoreMenu(false); }}
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Click-outside overlay to close more menu */}
        {showMoreMenu && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 190 }}
            onClick={() => setShowMoreMenu(false)}
          />
        )}

        {/* Slim Day Selector */}
        <div className="day-strip">
          <button
            className="nav-btn"
            onClick={() => goToDay('prev')}
            disabled={selectedDayIndex === 0}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="days-scroll" ref={daysScrollRef}>
            {plan.days.map((day) => {
              const isSelected = day.id === selectedDayId;
              const isToday = day.date === today;
              const dayProgress = calculateDayProgress(day);

              return (
                <button
                  key={day.id}
                  className={`day-pill ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelectedDayId(day.id)}
                >
                  {isToday && <span className="today-dot" />}
                  <span className="day-num">D{day.dayNumber}</span>
                  <span className="day-short">{new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })}</span>
                  {dayProgress.total > 0 && (
                    <span className="day-count">{dayProgress.completed}/{dayProgress.total}</span>
                  )}
                  {day.notes && <span className="notes-dot" title="Has notes" />}
                </button>
              );
            })}
          </div>

          <button
            className="nav-btn"
            onClick={() => goToDay('next')}
            disabled={selectedDayIndex === plan.days.length - 1}
          >
            <ChevronRight size={18} />
          </button>

          <button
            className="nav-btn day-picker-btn"
            title="Jump to day"
            onClick={() => setShowDayPicker(true)}
          >
            <Calendar size={15} />
          </button>
        </div>

        {/* Progress Bar */}
        {selectedDay && progress.total > 0 && (
          <div className="day-progress">
            <CheckCircle2 size={14} />
            <span>{progress.completed} of {progress.total}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.percentage}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Day Notes Panel */}
      {showNotesPanel && selectedDay && (
        <div className="notes-panel">
          <div className="notes-header">
            <StickyNote size={14} />
            <span>Day Summary &amp; Notes</span>
          </div>
          <textarea
            className="notes-textarea"
            placeholder="Add notes, reminders, or a summary for this day…"
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            rows={3}
          />
          <div className="notes-footer">
            <button
              className="notes-save-btn"
              onClick={() => handleSaveNotes(notesValue)}
              disabled={notesSaving}
            >
              {notesSaving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </div>
      )}

      {/* Main content — Timeline or Text view */}
      <div
        className="timeline-container"
        ref={timelineScrollRef}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
          if (Math.abs(dx) > 60 && dy < 40) {
            if (dx < 0) goToDay('next');
            else goToDay('prev');
          }
        }}
      >
        {displayDay && viewMode === 'timeline' && (
          <>
            <Timeline
              day={displayDay}
              onActivityUpdate={handleActivityUpdate}
              onActivityDelete={handleActivityDelete}
              onActivityReorder={handleActivityReorder}
              onAddActivity={handleAddActivity}
              onEditActivity={handleEditActivity}
              onPopupOpenChange={setIsDetailPopupOpen}
              isEditable={isEditable && !isUnauthenticatedViewer}
            />
            {isUnauthenticatedViewer && previewSlice.hiddenCount > 0 && (
              <PaywallCard hiddenCount={previewSlice.hiddenCount} kind="activities" />
            )}
          </>
        )}

        {displayDay && viewMode === 'text' && (
          <div className="text-view">
            <div className="text-day-header">
              <h2>{displayDay.title || `Day ${displayDay.dayNumber}`}</h2>
              <span className="text-day-date">
                <Calendar size={13} />
                {new Date(displayDay.date + 'T12:00:00').toLocaleDateString('en', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}
              </span>
              {displayDay.notes && (
                <p className="text-day-notes">{displayDay.notes}</p>
              )}
            </div>

            {displayDay.activities.length === 0 ? (
              <p className="text-empty">No activities planned for this day.</p>
            ) : (
              <div className="text-activities">
                {[...displayDay.activities]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((activity) => {
                    const endH = (() => {
                      const [h, m] = activity.startTime.split(':').map(Number);
                      const total = h * 60 + m + activity.duration;
                      return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
                    })();
                    return (
                      <div key={activity.id} className="text-activity" onClick={() => setViewingActivity(activity)} style={{ cursor: 'pointer' }}>
                        <div
                          className="text-activity-bar"
                          style={{ background: ACTIVITY_COLORS[activity.type] }}
                        />
                        <div className="text-activity-body">
                          <div className="text-activity-top">
                            <span className="text-activity-icon">{ACTIVITY_ICONS[activity.type]}</span>
                            <span className="text-activity-title">{activity.title}</span>
                            <span className="text-activity-status" data-status={activity.status}>
                              {activity.status}
                            </span>
                          </div>
                          <div className="text-activity-meta">
                            <span><Clock size={11} /> {activity.startTime} – {endH}</span>
                            <span>{formatDuration(activity.duration)}</span>
                            {activity.location && <span><MapPin size={11} /> {activity.location}</span>}
                            {activity.cost != null && <span>💰 {activity.cost}</span>}
                          </div>
                          {activity.description && (
                            <p className="text-activity-desc">{activity.description}</p>
                          )}
                          {activity.notes && (
                            <p className="text-activity-notes">📝 {activity.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            {isUnauthenticatedViewer && previewSlice.hiddenCount > 0 && (
              <PaywallCard hiddenCount={previewSlice.hiddenCount} kind="activities" />
            )}
          </div>
        )}
      </div>

      {/* Floating Add Button — hidden when popup open or view-only */}
      {!isDetailPopupOpen && isEditable && (
        <button
          className="fab-add"
          onClick={() => handleAddActivity('09:00')}
          title="Add Activity"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Floating AI Button — hidden when popup open or view-only */}
      {!isDetailPopupOpen && isEditable && (
        <button
          className="fab-ai"
          onClick={() => setShowAIPanel(true)}
          title="AI Assistant"
        >
          <Sparkles size={22} />
        </button>
      )}

      {/* AI Panel Modal */}
      {showAIPanel && selectedDay && (
        <div className="ai-modal-overlay" onClick={() => setShowAIPanel(false)}>
          <div className="ai-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="ai-header-title">
                <Sparkles size={18} />
                <span>AI Assistant</span>
              </div>
              <button className="close-btn" onClick={() => setShowAIPanel(false)}>
                <X size={20} />
              </button>
            </div>
            <AIPanel
              day={selectedDay}
              preferences={plan.preferences}
              destination={plan.destination}
              onAddActivity={(activity) => {
                handleSaveActivity(activity);
              }}
              onReplaceActivities={handleReplaceActivities}
              onSuggestChange={(activityId, changes) => {
                const activity = selectedDay.activities.find(a => a.id === activityId);
                if (activity) {
                  handleActivityUpdate({ ...activity, ...changes });
                }
              }}
              isFloating={true}
            />
          </div>
        </div>
      )}

      {/* Activity Modal */}
      <ActivityModal
        isOpen={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setEditingActivity(null);
        }}
        onSave={handleSaveActivity}
        initialTime={newActivityTime}
        editActivity={editingActivity}
      />

      {/* Sharing Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content share-modal" role="dialog" aria-modal="true" aria-label="Sharing" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sharing</h3>
              <button className="close-btn" onClick={() => setShowShareModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="share-tabs">
              <button
                className={`share-tab ${shareModalTab === 'links' ? 'active' : ''}`}
                onClick={() => setShareModalTab('links')}
              >
                <Link2 size={14} />
                Share Links
              </button>
              <button
                className={`share-tab ${shareModalTab === 'people' ? 'active' : ''}`}
                onClick={() => setShareModalTab('people')}
              >
                <Users size={14} />
                People with Access
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
                  {/* View link */}
                  {(() => {
                    const viewLink = shareLinks.find(l => l.permission === 'view' && l.isActive);
                    const viewUrl = viewLink ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?share=${viewLink.token}` : '';
                    return (
                      <div className="share-section">
                        <div className="share-section-title">
                          <span className="share-perm-badge view">👁 View only</span>
                          <span className="share-section-hint">Recipients can view but not edit</span>
                        </div>
                        {viewLink ? (
                          <div className="share-link-row">
                            <div className="share-link-url">{viewUrl}</div>
                            <button className="share-action-btn copy" onClick={() => copyLink(viewUrl, viewLink.id)}>
                              {shareCopied === viewLink.id ? <Check size={14} /> : <Copy size={14} />}
                              {shareCopied === viewLink.id ? 'Copied' : 'Copy'}
                            </button>
                            <button className="share-action-btn revoke" onClick={() => handleRevokeLink(viewLink.id)}>
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <button
                            className="share-generate-btn"
                            onClick={() => handleGenerateLink('view')}
                            disabled={shareLinkGenerating === 'view'}
                          >
                            <Link2 size={14} />
                            {shareLinkGenerating === 'view' ? 'Generating…' : 'Generate view link'}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Edit link */}
                  {(() => {
                    const editLink = shareLinks.find(l => l.permission === 'edit' && l.isActive);
                    const editUrl = editLink ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?share=${editLink.token}` : '';
                    return (
                      <div className="share-section">
                        <div className="share-section-title">
                          <span className="share-perm-badge edit">✏️ Can edit</span>
                          <span className="share-section-hint">Recipients can view and make changes</span>
                        </div>
                        {editLink ? (
                          <div className="share-link-row">
                            <div className="share-link-url">{editUrl}</div>
                            <button className="share-action-btn copy" onClick={() => copyLink(editUrl, editLink.id)}>
                              {shareCopied === editLink.id ? <Check size={14} /> : <Copy size={14} />}
                              {shareCopied === editLink.id ? 'Copied' : 'Copy'}
                            </button>
                            <button className="share-action-btn revoke" onClick={() => handleRevokeLink(editLink.id)}>
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <button
                            className="share-generate-btn"
                            onClick={() => handleGenerateLink('edit')}
                            disabled={shareLinkGenerating === 'edit'}
                          >
                            <Link2 size={14} />
                            {shareLinkGenerating === 'edit' ? 'Generating…' : 'Generate edit link'}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* People with access tab */
                <div className="share-members">
                  {shareMembers.length === 0 ? (
                    <div className="share-empty">
                      <Users size={32} />
                      <p>No one has accessed this plan yet.</p>
                      <p className="share-empty-hint">Generate a share link and send it to collaborators.</p>
                    </div>
                  ) : (
                    shareMembers.map(member => {
                      const displayName = member.userName || member.userEmail || 'Unknown user';
                      const displayEmail = member.userEmail || null;
                      const avatarLetter = displayName[0].toUpperCase();
                      return (
                        <div key={member.id} className="share-member-row">
                          <div className="share-member-avatar">{avatarLetter}</div>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Plan Settings</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-section">
                <h4>Plan Details</h4>
                <div className="setting-item">
                  <span className="setting-label">Title</span>
                  <span className="setting-value">{plan.title}</span>
                </div>
                {plan.destination && (
                  <div className="setting-item">
                    <span className="setting-label">Destination</span>
                    <span className="setting-value">{plan.destination}</span>
                  </div>
                )}
                <div className="setting-item">
                  <span className="setting-label">Dates</span>
                  <span className="setting-value">{formatDate(plan.startDate)} - {formatDate(plan.endDate)}</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Duration</span>
                  <span className="setting-value">{plan.days.length} days</span>
                </div>
              </div>

              <div className="settings-section">
                <h4>Preferences</h4>
                <div className="setting-item">
                  <span className="setting-label">Wake up time</span>
                  <span className="setting-value">{plan.preferences.wakeUpTime}</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Sleep time</span>
                  <span className="setting-value">{plan.preferences.sleepTime}</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Pace</span>
                  <span className="setting-value" style={{textTransform: 'capitalize'}}>{plan.preferences.pace}</span>
                </div>
              </div>

              <button className="danger-btn" onClick={() => {
                setShowSettingsModal(false);
                setShowDeleteConfirm(true);
              }}>
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Picker Modal */}
      {showDayPicker && (
        <div className="modal-overlay" onClick={() => setShowDayPicker(false)}>
          <div className="modal-content day-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Jump to Day</h3>
              <button className="close-btn" onClick={() => setShowDayPicker(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="day-picker-list">
              {plan.days.map((day) => {
                const isSelected = day.id === selectedDayId;
                const isToday = day.date === today;
                const dp = calculateDayProgress(day);
                return (
                  <button
                    key={day.id}
                    className={`day-picker-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setSelectedDayId(day.id); setShowDayPicker(false); }}
                  >
                    <span className="day-picker-num">Day {day.dayNumber}</span>
                    <div className="day-picker-info">
                      <span className="day-picker-date">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                        {isToday && <span className="day-picker-today"> · Today</span>}
                      </span>
                      {day.title && <span className="day-picker-title">{day.title}</span>}
                    </div>
                    <span className="day-picker-count">{dp.completed}/{dp.total}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Plan"
        message={`Delete "${plan.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeletePlan}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Edit Plan Modal */}
      {showEditPlanModal && (
        <div className="edit-overlay" onClick={() => setShowEditPlanModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <h3>Edit plan</h3>
              <button className="edit-close" onClick={() => setShowEditPlanModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="edit-body">
              <label className="edit-field">
                <span>Title</span>
                <input
                  value={editPlanData.title}
                  onChange={(e) => setEditPlanData((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Plan title"
                />
              </label>
              <label className="edit-field">
                <span>Destination</span>
                <input
                  value={editPlanData.destination}
                  onChange={(e) => setEditPlanData((d) => ({ ...d, destination: e.target.value }))}
                  placeholder="e.g. Tokyo, Japan"
                />
              </label>
              <label className="edit-field">
                <span>Description</span>
                <textarea
                  value={editPlanData.description}
                  onChange={(e) => setEditPlanData((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Optional notes"
                  rows={3}
                />
              </label>
              <div className="edit-row">
                <label className="edit-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={editPlanData.startDate}
                    onChange={(e) => setEditPlanData((d) => ({ ...d, startDate: e.target.value }))}
                  />
                </label>
                <label className="edit-field">
                  <span>End date</span>
                  <input
                    type="date"
                    value={editPlanData.endDate}
                    onChange={(e) => setEditPlanData((d) => ({ ...d, endDate: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="edit-foot">
              <button className="edit-cancel" onClick={() => setShowEditPlanModal(false)}>Cancel</button>
              <button
                className="edit-save"
                onClick={handleSaveEditPlan}
                disabled={editPlanSaving || !editPlanData.title.trim() || !editPlanData.startDate || !editPlanData.endDate}
              >
                {editPlanSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity detail popup — for list-view clicks */}
      {viewingActivity && (
        <ActivityDetailPopup
          activity={viewingActivity}
          onClose={() => setViewingActivity(null)}
          onStatusChange={(status) => {
            handleActivityUpdate({ ...viewingActivity, status });
            setViewingActivity(null);
          }}
          onEdit={() => {
            handleEditActivity(viewingActivity);
            setViewingActivity(null);
          }}
          onDelete={() => {
            handleActivityDelete(viewingActivity.id);
            setViewingActivity(null);
          }}
        />
      )}

      <style jsx>{`
        .plan-view {
          height: 100dvh;
          background: var(--background);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        /* Sticky top block */
        .sticky-top {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--card);
          border-bottom: 1px solid var(--border);
        }

        /* Compact Header */
        .plan-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--card);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--foreground);
          cursor: pointer;
          flex-shrink: 0;
        }

        .back-btn:hover {
          background: var(--muted);
        }

        .header-center {
          flex: 1;
          min-width: 0;
        }

        .header-center h1 {
          font-size: 17px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }

        .destination {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted-foreground);
          margin-top: 2px;
        }

        .header-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: var(--muted);
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .btn-icon:hover {
          color: var(--foreground);
        }

        /* Day Strip */
        .day-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 8px;
          border-bottom: 1px solid var(--border);
        }

        .nav-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: var(--muted);
          color: var(--foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .days-scroll {
          flex: 1;
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 2px;
        }

        .days-scroll::-webkit-scrollbar {
          display: none;
        }

        .day-pill {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--muted);
          border: 2px solid transparent;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted-foreground);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .day-pill:hover {
          color: var(--foreground);
        }

        .day-pill.selected {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .day-pill.today:not(.selected) {
          border-color: var(--accent);
        }

        .today-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: var(--accent);
          border-radius: 50%;
          border: 2px solid var(--card);
        }

        .day-pill.selected .today-dot {
          background: white;
          border-color: var(--primary);
        }

        .day-num {
          font-weight: 700;
        }

        .day-short {
          font-weight: 400;
        }

        .day-count {
          font-size: 11px;
          padding: 2px 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
        }

        .day-pill:not(.selected) .day-count {
          background: var(--border);
        }

        .notes-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          flex-shrink: 0;
        }

        .day-pill.selected .notes-dot {
          background: rgba(255,255,255,0.8);
        }

        /* Progress Bar */
        .day-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          font-size: 12px;
          color: var(--muted-foreground);
        }

        /* View mode toggle */
        .view-toggle {
          display: flex;
          background: var(--muted);
          border-radius: 8px;
          padding: 3px;
          gap: 2px;
        }

        .view-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: none;
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .view-btn.active {
          background: var(--card);
          color: var(--foreground);
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        .btn-icon.active {
          background: color-mix(in srgb, var(--primary) 15%, transparent);
          color: var(--primary);
        }

        /* Desktop header action buttons (hidden on mobile) */
        .header-actions-desktop {
          display: flex;
          gap: 4px;
        }

        /* Mobile overflow menu (hidden on desktop) */
        .header-more-wrap {
          display: none;
          position: relative;
        }

        .more-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          min-width: 160px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          z-index: 200;
        }

        .more-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: none;
          font-size: 14px;
          color: var(--foreground);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          white-space: nowrap;
        }

        .more-menu-item:hover {
          background: var(--muted);
        }

        .more-menu-item.active-item {
          color: var(--primary);
        }

        @media (max-width: 520px) {
          .header-actions-desktop {
            display: none;
          }
          .header-more-wrap {
            display: block;
          }
        }

        /* Notes panel */
        .notes-panel {
          background: color-mix(in srgb, var(--accent) 6%, var(--card));
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .notes-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .notes-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 16px;
          background: var(--card);
          color: var(--foreground);
          resize: vertical;
          min-height: 72px;
          font-family: inherit;
          line-height: 1.5;
          box-sizing: border-box;
        }

        .notes-textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
        }

        .notes-footer {
          display: flex;
          justify-content: flex-end;
        }

        .notes-save-btn {
          padding: 7px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .notes-save-btn:hover { opacity: 0.88; }
        .notes-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Text view */
        .text-view {
          padding: 20px 16px;
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
        }

        .text-day-header {
          margin-bottom: 20px;
        }

        .text-day-header h2 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 4px;
        }

        .text-day-date {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          color: var(--muted-foreground);
        }

        .text-day-notes {
          margin: 10px 0 0;
          font-size: 14px;
          color: var(--muted-foreground);
          background: color-mix(in srgb, var(--accent) 8%, var(--card));
          border-left: 3px solid var(--accent);
          padding: 8px 12px;
          border-radius: 0 8px 8px 0;
          line-height: 1.55;
        }

        .text-empty {
          font-size: 14px;
          color: var(--muted-foreground);
          text-align: center;
          padding: 40px 0;
        }

        .text-activities {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .text-activity {
          display: flex;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--card);
        }

        .text-activity-bar {
          width: 5px;
          flex-shrink: 0;
        }

        .text-activity-body {
          flex: 1;
          padding: 12px 14px;
          min-width: 0;
        }

        .text-activity-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .text-activity-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .text-activity-title {
          font-size: 15px;
          font-weight: 600;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .text-activity-status {
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 20px;
          background: var(--muted);
          color: var(--muted-foreground);
          white-space: nowrap;
          flex-shrink: 0;
          text-transform: capitalize;
        }

        .text-activity-status[data-status='completed'] {
          background: color-mix(in srgb, #22c55e 15%, transparent);
          color: #16a34a;
        }

        .text-activity-status[data-status='in-progress'] {
          background: color-mix(in srgb, var(--primary) 15%, transparent);
          color: var(--primary);
        }

        .text-activity-status[data-status='skipped'] {
          background: color-mix(in srgb, #ef4444 10%, transparent);
          color: #dc2626;
        }

        .text-activity-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--muted-foreground);
          margin-bottom: 2px;
        }

        .text-activity-meta span {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .text-activity-desc {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 6px 0 0;
          line-height: 1.5;
        }

        .text-activity-notes {
          font-size: 12px;
          color: var(--muted-foreground);
          margin: 4px 0 0;
          font-style: italic;
        }

        .day-progress :global(svg) {
          color: var(--primary);
        }

        .progress-bar {
          flex: 1;
          height: 4px;
          background: var(--muted);
          border-radius: 2px;
          overflow: hidden;
          max-width: 150px;
        }

        .progress-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          transition: width 0.3s;
        }

        /* Timeline Container */
        .timeline-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
          min-height: 0;
        }

        /* Floating Action Buttons */
        .fab-add, .fab-ai {
          position: fixed;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          z-index: 50;
          transition: all 0.2s;
        }

        .fab-add {
          /* Safe-area is baked into the base rule (0px fallback) so devices
             that don't advertise env() support still get the fix — the
             previous @supports gate silently hid FABs behind the home
             indicator on older WebViews. */
          bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          right: 24px;
          background: var(--primary);
          color: white;
        }

        .fab-ai {
          bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          right: 92px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
        }

        .fab-add:hover, .fab-ai:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
        }

        .fab-add:active, .fab-ai:active {
          transform: translateY(0);
        }

        /* AI Modal */
        .ai-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
          padding: 16px;
        }

        .ai-modal {
          width: 100%;
          max-width: 480px;
          /* dvh so the sheet shrinks when the iOS keyboard opens; safe-area
             keeps it clear of the notch. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px));
          background: var(--card);
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .ai-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 10%, var(--card)),
            color-mix(in srgb, var(--accent) 10%, var(--card))
          );
        }

        .ai-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--foreground);
        }

        .ai-header-title :global(svg) {
          color: var(--primary);
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: var(--muted);
          color: var(--foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .close-btn:hover {
          background: var(--border);
        }

        /* Share & Settings Modals */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
          padding: 16px;
        }

        .modal-content {
          width: 100%;
          max-width: 400px;
          /* Flex column + dvh + safe-area so long member/share lists don't
             push the CTA buttons out of view. Body scrolls, footer stays. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px));
          background: var(--card);
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .modal-body {
          /* Fill remaining space and scroll internally; min-height: 0 lets
             this flex child actually shrink below its content, which is
             required for the sticky header/footer pattern to work. */
          flex: 1 1 auto;
          min-height: 0;
          padding: 20px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Share Modal */
        .share-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          padding: 0 20px;
          gap: 4px;
        }
        .share-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--muted-foreground);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
        }
        .share-tab.active {
          color: var(--foreground);
          border-bottom-color: var(--primary, #6366f1);
        }
        .share-tab-count {
          background: var(--primary, #6366f1);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 10px;
          padding: 1px 6px;
          min-width: 18px;
          text-align: center;
        }
        .share-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px 0;
          color: var(--muted-foreground);
          text-align: center;
        }
        .share-empty p { margin: 0; font-size: 14px; }
        .share-empty-hint { font-size: 12px; opacity: 0.7; }
        .share-loading {
          text-align: center;
          color: var(--muted-foreground);
          padding: 24px 0;
          font-size: 14px;
        }

        .share-section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .share-section:last-of-type { border-bottom: none; margin-bottom: 0; }

        .share-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .share-perm-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
        }

        .share-perm-badge.view {
          background: color-mix(in srgb, #6366f1 12%, transparent);
          color: #6366f1;
        }

        .share-perm-badge.edit {
          background: color-mix(in srgb, #f59e0b 12%, transparent);
          color: #d97706;
        }

        .share-section-hint {
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .share-link-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--muted);
          border-radius: 10px;
          padding: 8px 10px;
        }

        .share-link-url {
          flex: 1;
          font-size: 12px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .share-action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: none;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .share-action-btn.copy {
          background: var(--primary);
          color: white;
        }

        .share-action-btn.revoke {
          background: color-mix(in srgb, #ef4444 12%, transparent);
          color: #dc2626;
        }

        .share-generate-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          background: var(--muted);
          border: 1px dashed var(--border);
          border-radius: 10px;
          font-size: 13px;
          color: var(--muted-foreground);
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: all 0.15s;
        }

        .share-generate-btn:hover { background: var(--border); color: var(--foreground); }
        .share-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .share-members { margin-top: 16px; }

        .share-members-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin: 0 0 10px;
        }

        .share-member-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }

        .share-member-row:last-child { border-bottom: none; }

        .share-member-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--primary) 20%, transparent);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .share-member-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .share-member-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .share-member-email {
          font-size: 11px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .share-remove-btn {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: none;
          background: none;
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .share-remove-btn:hover {
          background: color-mix(in srgb, #ef4444 12%, transparent);
          color: #dc2626;
        }

        /* Settings Modal */
        .settings-section {
          margin-bottom: 24px;
        }

        .settings-section h4 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--muted-foreground);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        .setting-item:last-child {
          border-bottom: none;
        }

        .setting-label {
          font-size: 14px;
          color: var(--muted-foreground);
        }

        .setting-value {
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
        }

        .danger-btn {
          width: 100%;
          padding: 14px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }

        .danger-btn:hover {
          background: #dc2626;
        }

        .day-picker-btn {
          flex-shrink: 0;
        }

        .day-picker-modal .modal-header {
          border-radius: 20px 20px 0 0;
        }

        .day-picker-list {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          /* dvh so long day lists don't extend below the visible area on
             short/keyboard-open viewports. */
          max-height: 60dvh;
          padding: 8px 0;
        }

        .day-picker-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 20px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          color: var(--foreground);
        }

        .day-picker-item:hover { background: var(--muted); }

        .day-picker-item.selected {
          background: color-mix(in srgb, var(--primary) 10%, transparent);
        }

        .day-picker-num {
          font-size: 12px;
          font-weight: 700;
          color: var(--primary);
          min-width: 48px;
          flex-shrink: 0;
        }

        .day-picker-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .day-picker-date {
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
        }

        .day-picker-today {
          color: var(--primary);
          font-weight: 600;
        }

        .day-picker-title {
          font-size: 12px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .day-picker-count {
          font-size: 12px;
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        /* Desktop adjustments */
        @media (min-width: 768px) {
          .ai-modal-overlay,
          .modal-overlay {
            align-items: center;
          }

          .ai-modal {
            border-radius: 20px;
            max-height: 600px;
          }

          .modal-content {
            border-radius: 20px;
            max-height: 500px;
          }

          .fab-add {
            bottom: 32px;
            right: 32px;
          }

          .fab-ai {
            bottom: 32px;
            right: 104px;
          }
        }

        /* Mobile-specific header adjustments */
        @media (max-width: 400px) {
          .header-actions {
            gap: 4px;
          }

          .btn-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }

          .view-toggle {
            padding: 2px;
          }

          .view-btn {
            width: 40px;
            height: 40px;
          }

          .header-center h1 {
            font-size: 15px;
          }

          .day-pill {
            padding: 6px 10px;
            font-size: 12px;
          }
        }

        /* Safe area is now baked into the base .fab-add / .fab-ai rules
           above (with a 0px fallback) rather than gated behind @supports,
           which was skipped on some older iOS Capacitor WebViews. */

        /* Edit Plan modal */
        .edit-overlay {
          position: fixed; inset: 0; z-index: 1100;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .edit-modal {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 18px; width: 100%; max-width: 440px;
          /* dvh so keyboard doesn't cover Save; safe-area keeps content
             clear of the notch/home indicator. */
          max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 40px);
          overflow: hidden;
          display: flex; flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
        }
        .edit-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; border-bottom: 1px solid var(--border);
        }
        .edit-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--foreground); }
        .edit-close {
          background: none; border: none; cursor: pointer;
          color: var(--muted-foreground); padding: 4px; border-radius: 6px;
          display: flex;
        }
        .edit-close:hover { background: var(--muted); color: var(--foreground); }
        .edit-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px 18px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .edit-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .edit-field > span { font-weight: 500; color: var(--muted-foreground); font-size: 12px; }
        .edit-field input, .edit-field textarea {
          background: var(--background); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 12px; font-size: 14px;
          color: var(--foreground); font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .edit-field input:focus, .edit-field textarea:focus { border-color: var(--primary); }
        .edit-field textarea { resize: vertical; }
        .edit-row { display: flex; gap: 12px; }
        .edit-foot {
          flex-shrink: 0;
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 12px 18px calc(16px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border);
          background: var(--card);
        }
        .edit-cancel, .edit-save {
          padding: 10px 18px; border-radius: 10px; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .edit-cancel {
          background: var(--muted); border: 1px solid var(--border);
          color: var(--foreground);
        }
        .edit-cancel:hover { background: var(--border); }
        .edit-save {
          background: var(--primary); border: none; color: #fff;
        }
        .edit-save:hover:not(:disabled) { opacity: 0.9; }
        .edit-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default PlanView;

function PaywallCard({ hiddenCount, kind }: { hiddenCount: number; kind: string }) {
  return (
    <div className="paywall-card">
      <div className="paywall-icon"><Lock size={20} /></div>
      <h3 className="paywall-title">{hiddenCount} more {kind} hidden</h3>
      <p className="paywall-desc">Sign in to see the full plan and save your own copy.</p>
      <button className="paywall-btn" onClick={() => signIn('google')}>
        Sign in with Google
      </button>
      <style jsx>{`
        .paywall-card {
          margin: 16px;
          padding: 24px 20px;
          background: var(--card, #fff);
          border: 1px dashed var(--border, #e5e7eb);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }
        .paywall-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .paywall-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
        }
        .paywall-desc {
          margin: 0;
          font-size: 13px;
          color: var(--muted-foreground, #6b7280);
        }
        .paywall-btn {
          margin-top: 8px;
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          background: var(--primary);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .paywall-btn:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
