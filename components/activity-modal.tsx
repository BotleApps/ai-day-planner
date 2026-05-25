'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Map,
  Navigation,
  ExternalLink,
  Upload,
  Trash2,
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
  { label: '1.5 hrs', value: 90 },
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
      address: '',
      notes: '',
      cost: undefined,
      mapsUrl: '',
      imageUrl: '',
    }
  );

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(aiSuggestions.length > 0);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(
        editActivity || {
          title: '',
          description: '',
          type: 'activity',
          startTime: initialTime,
          duration: 60,
          location: '',
          address: '',
          notes: '',
          cost: undefined,
          mapsUrl: '',
          imageUrl: '',
        }
      );
      setShowSuggestions(aiSuggestions.length > 0);
      setShowAdvanced(false);
      setImageError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editActivity]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;

    const activity: Activity = {
      id: editActivity?.id || generateId(),
      title: formData.title!,
      description: formData.description || undefined,
      type: formData.type as ActivityType,
      startTime: formData.startTime || initialTime,
      duration: formData.duration || 60,
      location: formData.location || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      cost: formData.cost,
      mapsUrl: formData.mapsUrl || undefined,
      imageUrl: formData.imageUrl || undefined,
      status: editActivity?.status || 'planned',
      order: editActivity?.order || 0,
      aiSuggested: formData.aiSuggested,
    };

    onSave(activity);
    onClose();
  };

  const applySuggestion = (suggestion: Partial<Activity>) => {
    setFormData({ ...formData, ...suggestion, aiSuggested: true });
    setShowSuggestions(false);
  };

  const handleImageUpload = async (file: File) => {
    setImageError('');
    setImageUploading(true);
    try {
      if (file.size > 2 * 1024 * 1024) {
        setImageError('Image too large (max 2MB)');
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
    } catch {
      setImageError('Upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  };

  const generateMapsLink = () => {
    const query = formData.address || formData.location;
    if (!query) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    setFormData(prev => ({ ...prev, mapsUrl: url }));
  };

  const selectedType = ACTIVITY_TYPES.find(t => t.type === formData.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div className="drag-handle" />

        <div className="modal-header">
          <h2>{editActivity ? 'Edit Activity' : 'Add Activity'}</h2>
          <button className="close-btn" onClick={onClose} type="button">
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
                  type="button"
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
              <select
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
              >
                {DURATION_PRESETS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location + Maps */}
          <div className="form-group">
            <label>
              <MapPin size={14} />
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="Place name (e.g. Eiffel Tower)"
            />
          </div>

          {/* Maps Link */}
          <div className="form-group">
            <label>
              <Map size={14} />
              Maps Link
            </label>
            <div className="maps-row">
              <input
                type="url"
                value={formData.mapsUrl || ''}
                onChange={e => setFormData({ ...formData, mapsUrl: e.target.value })}
                placeholder="Paste Google Maps / Apple Maps URL"
              />
              <button
                type="button"
                className="maps-generate-btn"
                onClick={generateMapsLink}
                title="Auto-generate from location"
                disabled={!formData.location && !formData.address}
              >
                <Navigation size={16} />
              </button>
              {formData.mapsUrl && (
                <a
                  href={formData.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maps-open-btn"
                  title="Open in Maps"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
            {!formData.mapsUrl && (formData.location || formData.address) && (
              <button
                type="button"
                className="maps-autofill-hint"
                onClick={generateMapsLink}
              >
                Tap to generate Google Maps link from location
              </button>
            )}
          </div>

          {/* Photo */}
          <div className="form-group">
            <label>
              <ImageIcon size={14} />
              Photo
            </label>
            {formData.imageUrl ? (
              <div className="image-preview">
                <img src={formData.imageUrl} alt="Activity" />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            ) : (
              <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                {imageUploading ? (
                  <div className="upload-spinner" />
                ) : (
                  <>
                    <Upload size={20} />
                    <span>Tap to upload a photo</span>
                    <span className="upload-hint">JPG, PNG, WebP · Max 2MB</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            )}
            {imageError && <span className="input-error">{imageError}</span>}
          </div>

          {/* Advanced section toggle */}
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(v => !v)}
          >
            <ChevronDown
              size={16}
              style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
            />
            {showAdvanced ? 'Hide details' : 'More details'}
          </button>

          {showAdvanced && (
            <>
              {/* Address */}
              <div className="form-group">
                <label>
                  <MapPin size={14} />
                  Address (optional)
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label>
                  <FileText size={14} />
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any details..."
                  rows={3}
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label>Notes / Tips</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Private notes, tips, booking refs..."
                  rows={2}
                />
              </div>

              {/* Cost */}
              <div className="form-group">
                <label>
                  <DollarSign size={14} />
                  Estimated Cost
                </label>
                <input
                  type="number"
                  value={formData.cost ?? ''}
                  onChange={e => setFormData({ ...formData, cost: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={imageUploading}>
              {editActivity ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--card);
          border-radius: 24px 24px 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 94svh;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.25);
          animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @media (min-width: 640px) {
          .modal-overlay {
            align-items: center;
            padding: 20px;
          }
          .modal-content {
            border-radius: 20px;
            max-width: 520px;
            max-height: 90svh;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
          }
        }

        .drag-handle {
          width: 36px;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin: 12px auto 0;
        }

        @media (min-width: 640px) {
          .drag-handle { display: none; }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
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
          flex-shrink: 0;
          transition: background 0.15s;
        }

        .close-btn:hover {
          background: var(--border);
          color: var(--foreground);
        }

        .ai-suggestions {
          padding: 14px 20px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 6%, transparent),
            color-mix(in srgb, var(--accent) 6%, transparent)
          );
          border-bottom: 1px solid var(--border);
        }

        .suggestions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 10px;
        }

        .suggestions-list {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }

        .suggestions-list::-webkit-scrollbar { display: none; }

        .suggestion-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .suggestion-card:hover {
          border-color: var(--primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .suggestion-icon { font-size: 18px; }

        .suggestion-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .suggestion-title { font-size: 13px; font-weight: 500; }
        .suggestion-duration { font-size: 11px; color: var(--muted-foreground); }

        form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted-foreground);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 400px) {
          .form-row { grid-template-columns: 1fr; }
        }

        input, select, textarea {
          padding: 12px 14px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-size: 16px;
          background: var(--background);
          color: var(--foreground);
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
          width: 100%;
          box-sizing: border-box;
          font-family: inherit;
        }

        @media (min-width: 640px) {
          input, select, textarea { font-size: 14px; }
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
        }

        textarea {
          resize: vertical;
          min-height: 80px;
          line-height: 1.5;
        }

        .type-selector { position: relative; }

        .type-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          background: var(--background);
          color: var(--foreground);
          font-size: 15px;
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .type-button:hover { border-color: var(--primary); }

        .type-button svg {
          margin-left: auto;
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        .type-indicator {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .type-icon { font-size: 18px; }

        .type-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          padding: 6px;
          max-height: 260px;
          overflow-y: auto;
          z-index: 20;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
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
          border-radius: 10px;
          background: none;
          color: var(--foreground);
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .type-option:hover { background: var(--muted); }

        .type-option.selected {
          background: color-mix(in srgb, var(--primary) 15%, transparent);
          color: var(--primary);
          font-weight: 600;
        }

        /* Maps Row */
        .maps-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .maps-row input { flex: 1; }

        .maps-generate-btn,
        .maps-open-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1.5px solid var(--border);
          background: var(--background);
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
          text-decoration: none;
        }

        .maps-generate-btn:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 8%, transparent);
        }

        .maps-generate-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .maps-open-btn {
          background: color-mix(in srgb, #3b82f6 10%, transparent);
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .maps-open-btn:hover {
          background: #3b82f6;
          color: white;
        }

        .maps-autofill-hint {
          font-size: 12px;
          color: var(--primary);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* Image Upload */
        .image-upload-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          border: 2px dashed var(--border);
          border-radius: 14px;
          cursor: pointer;
          color: var(--muted-foreground);
          transition: all 0.2s;
          background: var(--background);
          min-height: 100px;
        }

        .image-upload-area:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 4%, transparent);
        }

        .image-upload-area span { font-size: 14px; font-weight: 500; }

        .upload-hint {
          font-size: 12px !important;
          font-weight: 400 !important;
          opacity: 0.7;
        }

        .upload-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .image-preview {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid var(--border);
        }

        .image-preview img {
          width: 100%;
          height: 180px;
          object-fit: cover;
          display: block;
        }

        .image-remove-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(4px);
        }

        .input-error {
          font-size: 12px;
          color: var(--destructive);
          margin-top: 4px;
        }

        /* Advanced toggle */
        .advanced-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--muted);
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted-foreground);
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: background 0.15s;
        }

        .advanced-toggle:hover {
          background: var(--border);
          color: var(--foreground);
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }

        .btn-secondary, .btn-primary {
          flex: 1;
          padding: 15px 20px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: var(--muted);
          border: 1.5px solid var(--border);
          color: var(--foreground);
        }

        .btn-secondary:hover { background: var(--border); }

        .btn-primary {
          background: var(--primary);
          border: none;
          color: white;
          box-shadow: 0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default ActivityModal;
