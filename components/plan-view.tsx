'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plan, DayPlan, Activity, DEFAULT_PREFERENCES } from '@/lib/types';
import { generateId, sortByTime, formatDate, getDayOfWeek, calculateDayProgress } from '@/lib/utils';
import Timeline from '@/components/timeline';
import AIPanel from '@/components/ai-panel';
import ActivityModal from '@/components/activity-modal';
import {
  Plus,
  Calendar,
  MapPin,
  Users,
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
} from 'lucide-react';

interface PlanViewProps {
  planId: string;
  onBack?: () => void;
}

export function PlanView({ planId, onBack }: PlanViewProps) {
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

  // Fetch plan
  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans?id=${planId}`);
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
  }, [planId, selectedDayId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const selectedDay = plan?.days.find(d => d.id === selectedDayId);
  const selectedDayIndex = plan?.days.findIndex(d => d.id === selectedDayId) ?? 0;

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

  // Handle share
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
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
          <button className="btn-icon" title="Share" onClick={() => setShowShareModal(true)}>
            <Share2 size={18} />
          </button>
          <button className="btn-icon" title="Settings" onClick={() => setShowSettingsModal(true)}>
            <Settings size={18} />
          </button>
        </div>
      </header>

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

      {/* Timeline - Main Content */}
      <div className="timeline-container">
        {selectedDay && (
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
                  value={typeof window !== 'undefined' ? window.location.href : ''} 
                />
                <button className="copy-btn" onClick={handleShare}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="share-options">
                <p className="share-label">Or share via</p>
                <div className="share-buttons">
                  <button 
                    className="share-option"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out my plan: ${plan.title}\n${window.location.href}`)}`, '_blank')}
                  >
                    WhatsApp
                  </button>
                  <button 
                    className="share-option"
                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Plan: ${plan.title}`)}&body=${encodeURIComponent(`Check out my plan: ${window.location.href}`)}`, '_blank')}
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
                if (confirm('Are you sure you want to delete this plan?')) {
                  fetch(`/api/plans?id=${plan._id}`, { method: 'DELETE' })
                    .then(() => {
                      setShowSettingsModal(false);
                      if (onBack) onBack();
                    });
                }
              }}>
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .plan-view {
          min-height: 100vh;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }

        /* Compact Header */
        .plan-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--card);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
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
          padding: 12px 8px;
          background: var(--card);
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

        /* Progress Bar */
        .day-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--card);
          border-bottom: 1px solid var(--border);
          font-size: 12px;
          color: var(--muted-foreground);
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
          padding-bottom: 100px;
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
