'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Activity, ActivityType, DayPlan } from '@/lib/types';
import {
  parseTime,
  formatTime,
  addMinutes,
  calculateEndTime,
  getActivityColor,
  getActivityIcon,
  formatDuration,
  cn,
} from '@/lib/utils';
import {
  GripVertical,
  Clock,
  MapPin,
  MoreHorizontal,
  Check,
  X,
  SkipForward,
  ArrowRight,
  Play,
  Coffee,
  Plus,
  Edit3,
  Trash2,
  Pause,
  RotateCcw,
} from 'lucide-react';

interface TimelineProps {
  day: DayPlan;
  onActivityUpdate: (activity: Activity) => void;
  onActivityDelete: (activityId: string) => void;
  onActivityReorder: (sourceIndex: number, destIndex: number) => void;
  onAddActivity: (startTime: string) => void;
  onEditActivity?: (activity: Activity) => void;
  isEditable?: boolean;
}

const HOUR_HEIGHT = 80; // pixels per hour
const START_HOUR = 6; // 6 AM
const END_HOUR = 24; // Midnight

export function Timeline({
  day,
  onActivityUpdate,
  onActivityDelete,
  onActivityReorder,
  onAddActivity,
  onEditActivity,
  isEditable = true,
}: TimelineProps) {
  const [draggedActivity, setDraggedActivity] = useState<string | null>(null);
  const [dropTargetTime, setDropTargetTime] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Generate hour markers
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Calculate position for time
  const getPositionForTime = useCallback((time: string): number => {
    const { hours, minutes } = parseTime(time);
    return ((hours - START_HOUR) * 60 + minutes) * (HOUR_HEIGHT / 60);
  }, []);

  // Calculate time from position
  const getTimeFromPosition = useCallback((y: number): string => {
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60 / 15) * 15; // Round to 15 min
    return formatTime(Math.min(hours, 23), minutes % 60);
  }, []);

  // Handle activity status change
  const handleStatusChange = (activity: Activity, newStatus: Activity['status']) => {
    onActivityUpdate({ ...activity, status: newStatus });
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, activityId: string) => {
    setDraggedActivity(activityId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over timeline
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + timelineRef.current.scrollTop;
    const time = getTimeFromPosition(y);
    setDropTargetTime(time);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedActivity || !dropTargetTime) return;

    const activity = day.activities.find(a => a.id === draggedActivity);
    if (activity) {
      onActivityUpdate({ ...activity, startTime: dropTargetTime });
    }

    setDraggedActivity(null);
    setDropTargetTime(null);
  };

  // Handle click on empty time slot
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!isEditable || !timelineRef.current) return;
    if ((e.target as HTMLElement).closest('.activity-card')) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + timelineRef.current.scrollTop;
    const time = getTimeFromPosition(y);
    onAddActivity(time);
  };

  // Get current time indicator position
  const getCurrentTimePosition = (): number | null => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (day.date !== todayStr) return null;
    
    const currentTime = formatTime(now.getHours(), now.getMinutes());
    return getPositionForTime(currentTime);
  };

  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="timeline-container">
      <div
        ref={timelineRef}
        className="timeline"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleTimelineClick}
      >
        {/* Hour markers */}
        <div className="timeline-hours">
          {hours.map(hour => (
            <div
              key={hour}
              className="timeline-hour"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="timeline-hour-label">
                {formatTime(hour, 0)}
              </span>
              <div className="timeline-hour-line" />
              <div className="timeline-half-hour-line" />
            </div>
          ))}
        </div>

        {/* Activities */}
        <div className="timeline-activities">
          {day.activities.map((activity, index) => {
            const top = getPositionForTime(activity.startTime);
            const height = (activity.duration / 60) * HOUR_HEIGHT;
            const endTime = calculateEndTime(activity);
            const color = getActivityColor(activity.type);
            const icon = getActivityIcon(activity.type);

            return (
              <div
                key={activity.id}
                className={cn(
                  'activity-card',
                  `status-${activity.status}`,
                  draggedActivity === activity.id && 'dragging',
                  activity.isBreak && 'is-break'
                )}
                style={{
                  top,
                  height: Math.max(height, 44),
                  '--activity-color': color,
                } as React.CSSProperties}
                draggable={isEditable}
                onDragStart={(e) => handleDragStart(e, activity.id)}
                onDragEnd={() => setDraggedActivity(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedActivity(activity);
                }}
              >
                <div className="activity-color-bar" style={{ backgroundColor: color }} />
                
                <div className="activity-main">
                  <div className="activity-header">
                    <span className="activity-icon">{icon}</span>
                    <span className="activity-title">{activity.title}</span>
                    {activity.aiSuggested && (
                      <span className="ai-badge">AI</span>
                    )}
                  </div>

                  <div className="activity-meta">
                    <Clock size={11} />
                    <span>{activity.startTime} - {endTime}</span>
                    <span className="activity-duration">({formatDuration(activity.duration)})</span>
                  </div>

                  {activity.location && height > 50 && (
                    <div className="activity-location">
                      <MapPin size={11} />
                      <span>{activity.location}</span>
                    </div>
                  )}
                </div>

                <div 
                  className="activity-status-dot"
                  data-status={activity.status}
                />
              </div>
            );
          })}

          {/* Drop target indicator */}
          {dropTargetTime && (
            <div
              className="drop-indicator"
              style={{ top: getPositionForTime(dropTargetTime) }}
            >
              <span>{dropTargetTime}</span>
            </div>
          )}

          {/* Current time indicator */}
          {currentTimePosition !== null && (
            <div
              className="current-time-indicator"
              style={{ top: currentTimePosition }}
            >
              <div className="current-time-dot" />
              <div className="current-time-line" />
            </div>
          )}
        </div>

        {/* Add activity hint */}
        {isEditable && day.activities.length === 0 && (
          <div className="timeline-empty">
            <Plus size={24} />
            <p>Click anywhere on the timeline to add an activity</p>
          </div>
        )}
      </div>

      {/* Activity Detail Popup */}
      {selectedActivity && (
        <ActivityDetailPopup
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onStatusChange={(status) => {
            handleStatusChange(selectedActivity, status);
            setSelectedActivity(null);
          }}
          onEdit={() => {
            if (onEditActivity) {
              onEditActivity(selectedActivity);
            }
            setSelectedActivity(null);
          }}
          onDelete={() => {
            onActivityDelete(selectedActivity.id);
            setSelectedActivity(null);
          }}
        />
      )}

      <style jsx>{`
        .timeline-container {
          position: relative;
          background: var(--card);
          border-radius: 16px;
          overflow: hidden;
        }

        .timeline {
          position: relative;
          display: flex;
          min-height: ${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px;
          overflow-y: auto;
          cursor: pointer;
        }

        .timeline-hours {
          width: 60px;
          flex-shrink: 0;
          border-right: 1px solid var(--border);
          background: var(--background);
        }

        .timeline-hour {
          position: relative;
          border-bottom: 1px solid var(--border);
        }

        .timeline-hour-label {
          position: absolute;
          top: -10px;
          right: 10px;
          font-size: 11px;
          font-weight: 500;
          color: var(--muted-foreground);
          background: var(--background);
          padding: 0 4px;
        }

        .timeline-hour-line {
          position: absolute;
          top: 0;
          left: 100%;
          right: 0;
          height: 1px;
          background: var(--border);
          width: calc(100vw - 60px);
        }

        .timeline-half-hour-line {
          position: absolute;
          top: 50%;
          left: 100%;
          right: 0;
          height: 1px;
          background: var(--border);
          opacity: 0.4;
          width: calc(100vw - 60px);
        }

        .timeline-activities {
          flex: 1;
          position: relative;
          padding: 0 8px;
        }

        .drop-indicator {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--primary);
          border-radius: 2px;
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .drop-indicator span {
          position: absolute;
          left: -55px;
          font-size: 10px;
          font-weight: 600;
          color: var(--primary);
          background: var(--background);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .current-time-indicator {
          position: absolute;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          pointer-events: none;
          z-index: 10;
        }

        .current-time-dot {
          width: 10px;
          height: 10px;
          background: #ef4444;
          border-radius: 50%;
          margin-left: -5px;
        }

        .current-time-line {
          flex: 1;
          height: 2px;
          background: #ef4444;
        }

        .timeline-empty {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: var(--muted-foreground);
          pointer-events: none;
        }

        .timeline-empty p {
          margin-top: 8px;
          font-size: 14px;
        }

        /* Clean Activity Card Styles */
        .activity-card {
          position: absolute;
          left: 12px;
          right: 12px;
          background: var(--card);
          border-radius: 10px;
          border: 1px solid var(--border);
          display: flex;
          align-items: stretch;
          cursor: pointer;
          transition: all 0.15s ease;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .activity-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: var(--activity-color);
        }

        .activity-card:active {
          transform: scale(0.99);
        }

        .activity-card.dragging {
          opacity: 0.5;
          cursor: grabbing;
        }

        .activity-card.status-completed {
          opacity: 0.6;
        }

        .activity-card.status-completed .activity-title {
          text-decoration: line-through;
        }

        .activity-card.status-skipped {
          opacity: 0.4;
        }

        .activity-card.status-in-progress {
          border-color: var(--activity-color);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--activity-color) 25%, transparent);
        }

        .activity-card.is-break {
          background: var(--muted);
          border-style: dashed;
        }

        .activity-color-bar {
          width: 4px;
          flex-shrink: 0;
        }

        .activity-main {
          flex: 1;
          padding: 8px 10px;
          min-width: 0;
        }

        .activity-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
        }

        .activity-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        .activity-title {
          font-weight: 600;
          font-size: 13px;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-badge {
          font-size: 8px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          padding: 2px 5px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .activity-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--muted-foreground);
        }

        .activity-duration {
          opacity: 0.7;
        }

        .activity-location {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          color: var(--muted-foreground);
          margin-top: 2px;
        }

        .activity-status-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--activity-color);
          opacity: 0.6;
        }

        .activity-status-dot[data-status="completed"] {
          background: #10b981;
          opacity: 1;
        }

        .activity-status-dot[data-status="in-progress"] {
          background: #3b82f6;
          opacity: 1;
          animation: pulse 2s infinite;
        }

        .activity-status-dot[data-status="skipped"] {
          background: #9ca3af;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// Activity Detail Popup Component
function ActivityDetailPopup({
  activity,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  onClose: () => void;
  onStatusChange: (status: Activity['status']) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const endTime = calculateEndTime(activity);
  const color = getActivityColor(activity.type);
  const icon = getActivityIcon(activity.type);

  const statusActions = [
    { status: 'planned' as const, icon: <RotateCcw size={16} />, label: 'Reset', show: activity.status !== 'planned' },
    { status: 'in-progress' as const, icon: <Play size={16} />, label: 'Start', show: activity.status === 'planned' },
    { status: 'completed' as const, icon: <Check size={16} />, label: 'Complete', show: activity.status !== 'completed' },
    { status: 'skipped' as const, icon: <SkipForward size={16} />, label: 'Skip', show: activity.status === 'planned' || activity.status === 'in-progress' },
  ].filter(a => a.show);

  return (
    <>
      <div className="popup-overlay" onClick={onClose} />
      <div className="popup-container">
        <div className="popup-header" style={{ borderColor: color }}>
          <span className="popup-icon">{icon}</span>
          <div className="popup-title-section">
            <h3>{activity.title}</h3>
            <span className="popup-type">{activity.type}</span>
          </div>
          <button className="popup-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-body">
          <div className="popup-info-row">
            <Clock size={16} />
            <span>{activity.startTime} - {endTime}</span>
            <span className="popup-duration">{formatDuration(activity.duration)}</span>
          </div>

          {activity.location && (
            <div className="popup-info-row">
              <MapPin size={16} />
              <span>{activity.location}</span>
            </div>
          )}

          {activity.description && (
            <p className="popup-description">{activity.description}</p>
          )}

          <div className="popup-status">
            <span className="status-label">Status:</span>
            <span className={`status-badge status-${activity.status}`}>
              {activity.status.replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="popup-actions">
          <div className="status-actions">
            {statusActions.map((action) => (
              <button
                key={action.status}
                className={`status-btn status-${action.status}`}
                onClick={() => onStatusChange(action.status)}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="popup-bottom-actions">
            <button className="action-btn edit" onClick={onEdit}>
              <Edit3 size={16} />
              Edit
            </button>
            <button className="action-btn delete" onClick={onDelete}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 200;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .popup-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--card);
          border-radius: 20px 20px 0 0;
          z-index: 201;
          animation: slideUp 0.25s ease;
          max-height: 80vh;
          overflow-y: auto;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @media (min-width: 640px) {
          .popup-container {
            bottom: auto;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 400px;
            border-radius: 20px;
            animation: popIn 0.2s ease;
          }

          @keyframes popIn {
            from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
        }

        .popup-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          border-bottom: 3px solid;
        }

        .popup-icon {
          font-size: 28px;
        }

        .popup-title-section {
          flex: 1;
        }

        .popup-title-section h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 2px 0;
        }

        .popup-type {
          font-size: 12px;
          color: var(--muted-foreground);
          text-transform: capitalize;
        }

        .popup-close {
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

        .popup-body {
          padding: 20px;
        }

        .popup-info-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 14px;
          color: var(--foreground);
        }

        .popup-info-row :global(svg) {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        .popup-duration {
          margin-left: auto;
          color: var(--muted-foreground);
          font-size: 13px;
        }

        .popup-description {
          font-size: 14px;
          color: var(--muted-foreground);
          line-height: 1.5;
          margin: 16px 0;
          padding: 12px;
          background: var(--muted);
          border-radius: 10px;
        }

        .popup-status {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-label {
          font-size: 13px;
          color: var(--muted-foreground);
        }

        .status-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          text-transform: capitalize;
        }

        .status-badge.status-planned {
          background: var(--muted);
          color: var(--foreground);
        }

        .status-badge.status-in-progress {
          background: #3b82f620;
          color: #3b82f6;
        }

        .status-badge.status-completed {
          background: #10b98120;
          color: #10b981;
        }

        .status-badge.status-skipped {
          background: #9ca3af20;
          color: #6b7280;
        }

        .popup-actions {
          padding: 16px 20px 20px;
          border-top: 1px solid var(--border);
        }

        .status-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .status-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--card);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .status-btn:hover {
          border-color: var(--primary);
        }

        .status-btn.status-in-progress:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .status-btn.status-completed:hover {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        .status-btn.status-skipped:hover {
          background: #6b7280;
          color: white;
          border-color: #6b7280;
        }

        .popup-bottom-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn.edit {
          background: var(--primary);
          color: white;
          border: none;
        }

        .action-btn.edit:hover {
          opacity: 0.9;
        }

        .action-btn.delete {
          background: none;
          border: 1px solid #ef4444;
          color: #ef4444;
        }

        .action-btn.delete:hover {
          background: #ef4444;
          color: white;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .popup-actions {
            padding-bottom: calc(20px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </>
  );
}

export default Timeline;
