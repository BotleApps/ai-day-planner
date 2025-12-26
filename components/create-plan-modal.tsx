'use client';

import React, { useState } from 'react';
import { Plan, DEFAULT_PREFERENCES, PlanPreferences } from '@/lib/types';
import { generateId, getDatesBetween, formatDate } from '@/lib/utils';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Sun,
  Moon,
  Coffee,
  Utensils,
} from 'lucide-react';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated?: (planId: string) => void;
}

type Step = 'basics' | 'dates' | 'preferences';

export function CreatePlanModal({ isOpen, onClose, onPlanCreated }: CreatePlanModalProps) {
  const [step, setStep] = useState<Step>('basics');
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    destination: '',
    description: '',
    startDate: '',
    endDate: '',
    preferences: { ...DEFAULT_PREFERENCES },
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'basics') setStep('dates');
    else if (step === 'dates') setStep('preferences');
  };

  const handleBack = () => {
    if (step === 'dates') setStep('basics');
    else if (step === 'preferences') setStep('dates');
  };

  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || 'Untitled Plan',
          destination: formData.destination,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate,
          preferences: formData.preferences,
        }),
      });
      
      const data = await res.json();
      if (data.plan) {
        onPlanCreated?.(data.plan._id);
        onClose();
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const canProceed = () => {
    if (step === 'basics') return formData.title.trim().length > 0;
    if (step === 'dates') return formData.startDate && formData.endDate;
    return true;
  };

  const updatePreference = (key: keyof PlanPreferences, value: unknown) => {
    setFormData({
      ...formData,
      preferences: { ...formData.preferences, [key]: value },
    });
  };

  const dayCount = formData.startDate && formData.endDate
    ? getDatesBetween(formData.startDate, formData.endDate).length
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Progress */}
        <div className="progress-steps">
          <div className={`step ${step === 'basics' ? 'active' : ''} ${['dates', 'preferences'].includes(step) ? 'done' : ''}`}>
            <div className="step-dot">1</div>
            <span>Basics</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step === 'dates' ? 'active' : ''} ${step === 'preferences' ? 'done' : ''}`}>
            <div className="step-dot">2</div>
            <span>Dates</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step === 'preferences' ? 'active' : ''}`}>
            <div className="step-dot">3</div>
            <span>Preferences</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="step-content">
          {step === 'basics' && (
            <div className="basics-step">
              <h2>Create Your Plan</h2>
              <p>Let&apos;s start with the basics of your trip or event.</p>

              <div className="form-group">
                <label>
                  <Sparkles size={14} />
                  Plan Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Summer Beach Vacation"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>
                  <MapPin size={14} />
                  Destination (optional)
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="e.g., Bali, Indonesia"
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What's this trip about?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 'dates' && (
            <div className="dates-step">
              <h2>When is your trip?</h2>
              <p>Select the start and end dates for your plan.</p>

              <div className="date-inputs">
                <div className="form-group">
                  <label>
                    <Calendar size={14} />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Calendar size={14} />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {dayCount > 0 && (
                <div className="day-count">
                  <Calendar size={20} />
                  <span>{dayCount} day{dayCount !== 1 ? 's' : ''} planned</span>
                </div>
              )}
            </div>
          )}

          {step === 'preferences' && (
            <div className="preferences-step">
              <h2>Your Preferences</h2>
              <p>Help AI understand your planning style.</p>

              <div className="preference-section">
                <h3>Daily Schedule</h3>
                <div className="time-inputs">
                  <div className="form-group">
                    <label>
                      <Sun size={14} />
                      Wake up time
                    </label>
                    <input
                      type="time"
                      value={formData.preferences.wakeUpTime}
                      onChange={e => updatePreference('wakeUpTime', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <Moon size={14} />
                      Sleep time
                    </label>
                    <input
                      type="time"
                      value={formData.preferences.sleepTime}
                      onChange={e => updatePreference('sleepTime', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="preference-section">
                <h3>Meal Times</h3>
                <div className="time-inputs three">
                  <div className="form-group">
                    <label>
                      <Coffee size={14} />
                      Breakfast
                    </label>
                    <input
                      type="time"
                      value={formData.preferences.mealTimes.breakfast}
                      onChange={e => updatePreference('mealTimes', {
                        ...formData.preferences.mealTimes,
                        breakfast: e.target.value,
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <Utensils size={14} />
                      Lunch
                    </label>
                    <input
                      type="time"
                      value={formData.preferences.mealTimes.lunch}
                      onChange={e => updatePreference('mealTimes', {
                        ...formData.preferences.mealTimes,
                        lunch: e.target.value,
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <Utensils size={14} />
                      Dinner
                    </label>
                    <input
                      type="time"
                      value={formData.preferences.mealTimes.dinner}
                      onChange={e => updatePreference('mealTimes', {
                        ...formData.preferences.mealTimes,
                        dinner: e.target.value,
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="preference-section">
                <h3>Activity Pace</h3>
                <div className="pace-selector">
                  {(['relaxed', 'moderate', 'packed'] as const).map(pace => (
                    <button
                      key={pace}
                      type="button"
                      className={`pace-btn ${formData.preferences.pace === pace ? 'selected' : ''}`}
                      onClick={() => updatePreference('pace', pace)}
                    >
                      {pace === 'relaxed' && '🌴'}
                      {pace === 'moderate' && '⚖️'}
                      {pace === 'packed' && '⚡'}
                      <span>{pace.charAt(0).toUpperCase() + pace.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {step !== 'basics' && (
            <button className="btn-secondary" onClick={handleBack}>
              <ChevronLeft size={18} />
              Back
            </button>
          )}
          
          <div style={{ flex: 1 }} />
          
          {step !== 'preferences' ? (
            <button 
              className="btn-primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              className="btn-primary create"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Plan'}
              <Sparkles size={18} />
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
          padding: 0;
        }

        .modal-content {
          position: relative;
          background: var(--card);
          border-radius: 24px 24px 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 95dvh;
          overflow-y: auto;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
        }

        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
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
          z-index: 10;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: var(--border);
          color: var(--foreground);
        }

        .progress-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px 20px;
          gap: 6px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .step-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--muted);
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .step.active .step-dot {
          background: var(--primary);
          color: white;
        }

        .step.done .step-dot {
          background: #22c55e;
          color: white;
        }

        .step span {
          font-size: 11px;
          color: var(--muted-foreground);
        }

        .step.active span {
          color: var(--foreground);
          font-weight: 500;
        }

        .step-line {
          flex: 1;
          height: 2px;
          background: var(--border);
          max-width: 40px;
          margin-bottom: 20px;
        }

        .step-content {
          padding: 0 20px 24px;
        }

        .step-content h2 {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .step-content > p {
          color: var(--muted-foreground);
          margin-bottom: 20px;
          font-size: 14px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted-foreground);
          margin-bottom: 8px;
        }

        input, textarea {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 16px;
          background: var(--background);
          color: var(--foreground);
          transition: all 0.2s ease;
        }

        input:focus, textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        textarea {
          resize: vertical;
        }

        .date-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .day-count {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          background: color-mix(in srgb, var(--primary) 10%, transparent);
          border-radius: 12px;
          margin-top: 20px;
          color: var(--primary);
          font-weight: 600;
          font-size: 14px;
        }

        .preference-section {
          margin-bottom: 20px;
        }

        .preference-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: 12px;
        }

        .time-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .time-inputs.three {
          grid-template-columns: repeat(3, 1fr);
        }

        .pace-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .pace-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 8px;
          background: var(--muted);
          border: 2px solid transparent;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 22px;
        }

        .pace-btn span {
          font-size: 12px;
          font-weight: 500;
          color: var(--muted-foreground);
        }

        .pace-btn:hover {
          border-color: var(--border);
        }

        .pace-btn.selected {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, transparent);
        }

        .pace-btn.selected span {
          color: var(--primary);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
          border-top: 1px solid var(--border);
          background: var(--card);
        }

        .btn-secondary, .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 15px;
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
          flex: 1;
          background: var(--primary);
          border: none;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary.create {
          background: linear-gradient(135deg, var(--primary), var(--accent));
        }

        /* Desktop */
        @media (min-width: 640px) {
          .modal-overlay {
            align-items: center;
            padding: 20px;
          }

          .modal-content {
            border-radius: 24px;
            max-width: 480px;
            max-height: 90vh;
          }

          .step-content {
            padding: 0 32px 32px;
          }

          .modal-actions {
            padding: 20px 32px;
          }
        }

        @media (max-width: 400px) {
          .date-inputs {
            grid-template-columns: 1fr;
          }

          .time-inputs.three {
            grid-template-columns: 1fr;
          }

          .pace-selector {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CreatePlanModal;
