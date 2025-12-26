'use client';

import React, { useState } from 'react';
import { Activity, ActivityType, ACTIVITY_COLORS, ACTIVITY_ICONS } from '@/lib/types';
import { generateId, formatDuration, cn } from '@/lib/utils';
import {
  X,
  Clock,
  MapPin,
  FileText,
  Tag,
  DollarSign,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  initialTime?: string;
  editActivity?: Activity | null;
  aiSuggestions?: Partial<Activity>[];
}

const ACTIVITY_TYPES: { type: ActivityType; label: string }[] = [
  { type: 'activity', label: 'Activity' },
  { type: 'meal', label: 'Meal' },
  { type: 'sightseeing', label: 'Sightseeing' },
  { type: 'entertainment', label: 'Entertainment' },
  { type: 'travel', label: 'Travel' },
  { type: 'rest', label: 'Rest/Break' },
  { type: 'shopping', label: 'Shopping' },
  { type: 'sports', label: 'Sports' },
  { type: 'wellness', label: 'Wellness' },
  { type: 'social', label: 'Social' },
  { type: 'work', label: 'Work' },
  { type: 'custom', label: 'Custom' },
];

const DURATION_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
];

export function ActivityModal({
  isOpen,
  onClose,
  onSave,
  initialTime = '09:00',
  editActivity,
  aiSuggestions = [],
}: ActivityModalProps) {
  const [formData, setFormData] = useState<Partial<Activity>>(
    editActivity || {
      title: '',
      description: '',
      type: 'activity',
      startTime: initialTime,
      duration: 60,
      location: '',
      notes: '',
      cost: undefined,
    }
  );

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(aiSuggestions.length > 0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title?.trim()) return;

    const activity: Activity = {
      id: editActivity?.id || generateId(),
      title: formData.title!,
      description: formData.description,
      type: formData.type as ActivityType,
      startTime: formData.startTime || initialTime,
      duration: formData.duration || 60,
      location: formData.location,
      notes: formData.notes,
      cost: formData.cost,
      status: editActivity?.status || 'planned',
      order: editActivity?.order || 0,
      aiSuggested: formData.aiSuggested,
    };

    onSave(activity);
    onClose();
  };

  const applySuggestion = (suggestion: Partial<Activity>) => {
    setFormData({
      ...formData,
      ...suggestion,
      aiSuggested: true,
    });
    setShowSuggestions(false);
  };

  const selectedType = ACTIVITY_TYPES.find(t => t.type === formData.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editActivity ? 'Edit Activity' : 'Add Activity'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* AI Suggestions */}
        {showSuggestions && aiSuggestions.length > 0 && (
          <div className="ai-suggestions">
            <div className="suggestions-header">
              <Sparkles size={16} />
              <span>AI Suggestions</span>
            </div>
            <div className="suggestions-list">
              {aiSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-card"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <span className="suggestion-icon">
                    {ACTIVITY_ICONS[suggestion.type || 'activity']}
                  </span>
                  <div className="suggestion-info">
                    <span className="suggestion-title">{suggestion.title}</span>
                    {suggestion.duration && (
                      <span className="suggestion-duration">
                        {formatDuration(suggestion.duration)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Activity Type */}
          <div className="form-group">
            <label>Type</label>
            <div className="type-selector">
              <button
                type="button"
                className="type-button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              >
                <span 
                  className="type-indicator"
                  style={{ backgroundColor: ACTIVITY_COLORS[formData.type as ActivityType] }}
                />
                <span className="type-icon">{ACTIVITY_ICONS[formData.type as ActivityType]}</span>
                <span>{selectedType?.label}</span>
                <ChevronDown size={16} />
              </button>

              {showTypeDropdown && (
                <div className="type-dropdown">
                  {ACTIVITY_TYPES.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      className={cn('type-option', formData.type === type && 'selected')}
                      onClick={() => {
                        setFormData({ ...formData, type });
                        setShowTypeDropdown(false);
                      }}
                    >
                      <span 
                        className="type-indicator"
                        style={{ backgroundColor: ACTIVITY_COLORS[type] }}
                      />
                      <span className="type-icon">{ACTIVITY_ICONS[type]}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label>
              <Tag size={14} />
              Title
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="What's the activity?"
              autoFocus
              required
            />
          </div>

          {/* Time & Duration */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <Clock size={14} />
                Start Time
              </label>
              <input
                type="time"
                value={formData.startTime || ''}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Duration</label>
              <div className="duration-selector">
                <select
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                >
                  {DURATION_PRESETS.map(({ label, value }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="form-group">
            <label>
              <MapPin size={14} />
              Location (optional)
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="Where is this happening?"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>
              <FileText size={14} />
              Description (optional)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add any details..."
              rows={3}
            />
          </div>

          {/* Cost */}
          <div className="form-group">
            <label>
              <DollarSign size={14} />
              Estimated Cost (optional)
            </label>
            <input
              type="number"
              value={formData.cost || ''}
              onChange={e => setFormData({ ...formData, cost: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editActivity ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: var(--card);
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
        }

        .close-btn {
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
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: var(--border);
          color: var(--foreground);
        }

        .ai-suggestions {
          padding: 16px 24px;
          background: linear-gradient(135deg, 
            color-mix(in srgb, var(--primary) 5%, transparent),
            color-mix(in srgb, var(--accent) 5%, transparent)
          );
          border-bottom: 1px solid var(--border);
        }

        .suggestions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--primary);
          margin-bottom: 12px;
        }

        .suggestions-list {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .suggestion-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .suggestion-card:hover {
          border-color: var(--primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .suggestion-icon {
          font-size: 18px;
        }

        .suggestion-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .suggestion-title {
          font-size: 13px;
          font-weight: 500;
        }

        .suggestion-duration {
          font-size: 11px;
          color: var(--muted-foreground);
        }

        form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted-foreground);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        input, select, textarea {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 14px;
          background: var(--background);
          color: var(--foreground);
          transition: all 0.2s ease;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        textarea {
          resize: vertical;
          min-height: 80px;
        }

        .type-selector {
          position: relative;
        }

        .type-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--background);
          color: var(--foreground);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .type-button:hover {
          border-color: var(--primary);
        }

        .type-button svg {
          margin-left: auto;
          color: var(--muted-foreground);
        }

        .type-indicator {
          width: 12px;
          height: 12px;
          border-radius: 4px;
        }

        .type-icon {
          font-size: 16px;
        }

        .type-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          max-height: 280px;
          overflow-y: auto;
          z-index: 10;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px;
        }

        .type-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: none;
          color: var(--foreground);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .type-option:hover {
          background: var(--muted);
        }

        .type-option.selected {
          background: color-mix(in srgb, var(--primary) 15%, transparent);
        }

        .duration-selector select {
          width: 100%;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-secondary, .btn-primary {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary {
          background: var(--muted);
          border: 1px solid var(--border);
          color: var(--foreground);
        }

        .btn-secondary:hover {
          background: var(--border);
        }

        .btn-primary {
          background: var(--primary);
          border: none;
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        @media (max-width: 500px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .type-dropdown {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivityModal;
