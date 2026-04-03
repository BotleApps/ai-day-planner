'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plan, DayPlan, Activity, ACTIVITY_COLORS, ACTIVITY_ICONS } from '@/lib/types';
import { formatDate, calculateDayProgress, formatDuration } from '@/lib/utils';
import Timeline from '@/components/timeline';
import AIPanel from '@/components/ai-panel';
import ActivityModal from '@/components/activity-modal';
import ConfirmDialog from '@/components/confirm-dialog';
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
} from 'lucide-react';

interface PlanViewProps {
  planId: string;
  shareToken?: string;
  onBack?: () => void;
}

export function PlanView({ planId, shareToken, onBack }: PlanViewProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [newActivityTime, setNewActivityTime] = useState('09:00');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // View mode: 'timeline' | 'text' — persisted in localStorage
  const [viewMode, setViewMode] = useState<'timeline' | 'text'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('planViewMode') as 'timeline' | 'text') || 'timeline';
    }
    return 'timeline';
  });
  const [showViewPopover, setShowViewPopover] = useState(false);

  const switchViewMode = (mode: 'timeline' | 'text') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('planViewMode', mode);
    setShowViewPopover(false);
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
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

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
        if (!selectedDayId && data.plan.days.length > 0) {
          // Select today's day or first day
          const today = new Date().toISOString().split('T')[0];
          const todayDay = data.plan.days.find((d: DayPlan) => d.date === today);
          setSelectedDayId(todayDay?.id || data.plan.days[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [planId, shareToken, selectedDayId]);

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

  const selectedDay = plan?.days.find(d => d.id === selectedDayId);
  const selectedDayIndex = plan?.days.findIndex(d => d.id === selectedDayId) ?? 0;

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

  // Handle share — generate a persistent share link then copy it
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareGenerating, setShareGenerating] = useState(false);

  const openShareModal = async () => {
    setShowShareModal(true);
    setShareGenerating(true);
    try {
      const res = await fetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan!._id }),
      });
      const data = await res.json();
      if (data.shareLink) {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        setShareUrl(`${base}/?share=${data.shareLink}`);
      }
    } catch {
      setShareUrl(typeof window !== 'undefined' ? window.location.href : '');
    } finally {
      setShareGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Save activity
  const handleSaveActivity = async (activity: Activity) => {
    if (!plan || !selectedDayId) return;

    try {
      if (editingActivity) {
        // Update existing
        await fetch('/api/activities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan._id,
            dayId: selectedDayId,
            activityId: activity.id,
            updates: activity,
          }),
        });
      } else {
        // Add new
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan._id,
            dayId: selectedDayId,
            activity,
          }),
        });
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
      await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan._id,
          dayId: selectedDayId,
          activityId: activity.id,
          updates: activity,
        }),
      });
      fetchPlan();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  // Delete activity
  const handleActivityDelete = async (activityId: string) => {
    if (!plan || !selectedDayId) return;

    try {
      await fetch(`/api/activities?planId=${plan._id}&dayId=${selectedDayId}&activityId=${activityId}`, {
        method: 'DELETE',
      });
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
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan._id,
          dayId: selectedDayId,
          activities: newActivities,
        }),
      });
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

  return (
    <div className="plan-view">
      {/* Sticky top block: header + day strip + progress */}
      <div className="sticky-top">
        {/* Compact Header */}
        <header className="plan-header">
          <button onClick={onBack} className="back-btn">
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
            {/* View mode toggle — single button with popover */}
            <div className="view-toggle-wrap" onClick={e => e.stopPropagation()}>
              <button
                className={`btn-icon ${showViewPopover ? 'active' : ''}`}
                onClick={() => setShowViewPopover(v => !v)}
                title="Switch view"
              >
                {viewMode === 'timeline' ? <LayoutList size={17} /> : <AlignLeft size={17} />}
              </button>
              {showViewPopover && (
                <div className="view-popover">
                  <button
                    className={`view-popover-item ${viewMode === 'timeline' ? 'active-item' : ''}`}
                    onClick={() => switchViewMode('timeline')}
                  >
                    <LayoutList size={15} />
                    Timeline
                  </button>
                  <button
                    className={`view-popover-item ${viewMode === 'text' ? 'active-item' : ''}`}
                    onClick={() => switchViewMode('text')}
                  >
                    <AlignLeft size={15} />
                    List
                  </button>
                </div>
              )}
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
              <button className="btn-icon" title="Share" onClick={openShareModal}>
                <Share2 size={17} />
              </button>
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
                  <button
                    className="more-menu-item"
                    onClick={() => { openShareModal(); setShowMoreMenu(false); }}
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                  <button
                    className="more-menu-item"
                    onClick={openEditPlanModal}
                  >
                    <Edit2 size={16} />
                    Edit Plan
                  </button>
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

          <div className="days-scroll">
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
        {selectedDay && viewMode === 'timeline' && (
          <Timeline
            day={selectedDay}
            onActivityUpdate={handleActivityUpdate}
            onActivityDelete={handleActivityDelete}
            onActivityReorder={handleActivityReorder}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            isEditable={true}
          />
        )}

        {selectedDay && viewMode === 'text' && (
          <div className="text-view">
            <div className="text-day-header">
              <h2>{selectedDay.title || `Day ${selectedDay.dayNumber}`}</h2>
              <span className="text-day-date">
                <Calendar size={13} />
                {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('en', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}
              </span>
              {selectedDay.notes && (
                <p className="text-day-notes">{selectedDay.notes}</p>
              )}
            </div>

            {selectedDay.activities.length === 0 ? (
              <p className="text-empty">No activities planned for this day.</p>
            ) : (
              <div className="text-activities">
                {[...selectedDay.activities]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((activity) => {
                    const endH = (() => {
                      const [h, m] = activity.startTime.split(':').map(Number);
                      const total = h * 60 + m + activity.duration;
                      return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
                    })();
                    return (
                      <div key={activity.id} className="text-activity">
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
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button 
        className="fab-add"
        onClick={() => handleAddActivity('09:00')}
        title="Add Activity"
      >
        <Plus size={24} />
      </button>

      {/* Floating AI Button */}
      <button 
        className="fab-ai"
        onClick={() => setShowAIPanel(true)}
        title="AI Assistant"
      >
        <Sparkles size={22} />
      </button>

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

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content share-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share Plan</h3>
              <button className="close-btn" onClick={() => setShowShareModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="share-description">Share this plan with friends and family</p>
              
              <div className="share-link-box">
                <Link2 size={18} />
                <input
                  type="text"
                  readOnly
                  value={shareGenerating ? 'Generating link…' : shareUrl}
                />
                <button className="copy-btn" onClick={handleShare} disabled={shareGenerating || !shareUrl}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="share-options">
                <p className="share-label">Or share via</p>
                <div className="share-buttons">
                  <button
                    className="share-option"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out my plan: ${plan.title}\n${shareUrl}`)}`, '_blank')}
                  >
                    WhatsApp
                  </button>
                  <button
                    className="share-option"
                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Plan: ${plan.title}`)}&body=${encodeURIComponent(`Check out my plan: ${shareUrl}`)}`, '_blank')}
                  >
                    Email
                  </button>
                </div>
              </div>
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

      <style jsx>{`
        .plan-view {
          min-height: 100vh;
          background: var(--background);
          display: flex;
          flex-direction: column;
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
          padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
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
          bottom: 24px;
          right: 24px;
          background: var(--primary);
          color: white;
        }

        .fab-ai {
          bottom: 24px;
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
          max-height: 80vh;
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
          max-height: 80vh;
          background: var(--card);
          border-radius: 20px 20px 0 0;
          overflow: hidden;
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
          padding: 20px;
          overflow-y: auto;
        }

        /* Share Modal */
        .share-description {
          margin: 0 0 16px 0;
          color: var(--muted-foreground);
          font-size: 14px;
        }

        .share-link-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--muted);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .share-link-box :global(svg) {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        .share-link-box input {
          flex: 1;
          background: none;
          border: none;
          font-size: 13px;
          color: var(--foreground);
          min-width: 0;
        }

        .share-link-box input:focus {
          outline: none;
        }

        .copy-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }

        .copy-btn:hover {
          opacity: 0.9;
        }

        .share-label {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: var(--muted-foreground);
        }

        .share-buttons {
          display: flex;
          gap: 10px;
        }

        .share-option {
          flex: 1;
          padding: 12px;
          background: var(--muted);
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          transition: background 0.2s;
        }

        .share-option:hover {
          background: var(--border);
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
          max-height: 60vh;
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

        /* Safe area for mobile */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .fab-add, .fab-ai {
            bottom: calc(24px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}

export default PlanView;
