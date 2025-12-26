'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Activity, DayPlan, PlanPreferences, ACTIVITY_ICONS } from '@/lib/types';
import { generateId, formatDuration } from '@/lib/utils';
import {
  Sparkles,
  Send,
  Loader2,
  Wand2,
  Calendar,
  Clock,
  MapPin,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Zap,
} from 'lucide-react';

interface AIPanelProps {
  day: DayPlan;
  preferences: PlanPreferences;
  destination?: string;
  onAddActivity: (activity: Activity) => void;
  onReplaceActivities: (activities: Activity[]) => void;
  onSuggestChange: (activityId: string, changes: Partial<Activity>) => void;
  isFloating?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Partial<Activity>[];
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { icon: <Wand2 size={14} />, label: 'Plan my day', prompt: 'Create a full day plan with activities, meals, and breaks' },
  { icon: <Clock size={14} />, label: 'Add breaks', prompt: 'Suggest breaks between my current activities' },
  { icon: <MapPin size={14} />, label: 'Nearby activities', prompt: 'Suggest popular activities nearby' },
  { icon: <Lightbulb size={14} />, label: 'Fill gaps', prompt: 'Suggest activities for my free time slots' },
];

export function AIPanel({
  day,
  preferences,
  destination,
  onAddActivity,
  onReplaceActivities,
  onSuggestChange,
  isFloating = false,
}: AIPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAISuggestions = async (prompt: string): Promise<{
    message: string;
    suggestions: Partial<Activity>[];
  }> => {
    // Simulate AI response - In production, this would call your AI API
    await new Promise(resolve => setTimeout(resolve, 1500));

    const currentTime = day.activities.length > 0
      ? day.activities[day.activities.length - 1].startTime
      : preferences.wakeUpTime;

    // Generate contextual suggestions based on prompt
    if (prompt.toLowerCase().includes('plan') || prompt.toLowerCase().includes('day')) {
      return {
        message: `I've created a balanced day plan for ${destination || 'your trip'}! Here are activities spread throughout the day with proper breaks and meal times.`,
        suggestions: [
          {
            title: 'Morning Walk & Coffee',
            type: 'activity',
            duration: 45,
            startTime: '08:00',
            description: 'Start your day with fresh air and local coffee',
          },
          {
            title: 'Breakfast',
            type: 'meal',
            duration: 60,
            startTime: '09:00',
            location: 'Local café',
          },
          {
            title: 'Main Attraction Visit',
            type: 'sightseeing',
            duration: 180,
            startTime: '10:30',
            description: 'Explore the main highlights',
          },
          {
            title: 'Lunch Break',
            type: 'meal',
            duration: 75,
            startTime: '13:30',
          },
          {
            title: 'Afternoon Activity',
            type: 'entertainment',
            duration: 120,
            startTime: '15:00',
          },
          {
            title: 'Rest & Refresh',
            type: 'rest',
            duration: 60,
            startTime: '17:30',
          },
          {
            title: 'Dinner',
            type: 'meal',
            duration: 90,
            startTime: '19:00',
          },
        ],
      };
    }

    if (prompt.toLowerCase().includes('break')) {
      return {
        message: 'Based on your activities, here are some well-timed breaks to keep you refreshed:',
        suggestions: [
          {
            title: 'Coffee Break',
            type: 'rest',
            duration: 20,
            startTime: '10:30',
            description: 'Quick refreshment break',
          },
          {
            title: 'Afternoon Rest',
            type: 'rest',
            duration: 30,
            startTime: '15:00',
            description: 'Recharge your energy',
          },
        ],
      };
    }

    if (prompt.toLowerCase().includes('nearby') || prompt.toLowerCase().includes('activit')) {
      return {
        message: `Here are some popular activities ${destination ? `in ${destination}` : 'nearby'}:`,
        suggestions: [
          {
            title: 'Local Museum',
            type: 'sightseeing',
            duration: 120,
            description: 'Discover local history and culture',
          },
          {
            title: 'Walking Tour',
            type: 'activity',
            duration: 90,
            description: 'Guided tour of the area',
          },
          {
            title: 'Food Market',
            type: 'shopping',
            duration: 60,
            description: 'Try local delicacies',
          },
        ],
      };
    }

    // Default response
    return {
      message: 'Here are some suggestions based on your request:',
      suggestions: [
        {
          title: 'Suggested Activity',
          type: 'activity',
          duration: 60,
          description: 'Based on your preferences',
        },
      ],
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateAISuggestions(input);

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.message,
        suggestions: response.suggestions,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    handleSend();
  };

  const handleAddSuggestion = (suggestion: Partial<Activity>) => {
    const activity: Activity = {
      id: generateId(),
      title: suggestion.title || 'New Activity',
      type: suggestion.type || 'activity',
      startTime: suggestion.startTime || '12:00',
      duration: suggestion.duration || 60,
      description: suggestion.description,
      location: suggestion.location,
      status: 'planned',
      order: day.activities.length,
      aiSuggested: true,
    };
    onAddActivity(activity);
  };

  const handleAddAllSuggestions = (suggestions: Partial<Activity>[]) => {
    const activities: Activity[] = suggestions.map((s, index) => ({
      id: generateId(),
      title: s.title || 'Activity',
      type: s.type || 'activity',
      startTime: s.startTime || '12:00',
      duration: s.duration || 60,
      description: s.description,
      location: s.location,
      status: 'planned',
      order: index,
      aiSuggested: true,
    }));
    onReplaceActivities(activities);
  };

  return (
    <div className={`ai-panel ${isExpanded ? 'expanded' : 'collapsed'} ${isFloating ? 'floating' : ''}`}>
      {!isFloating && (
        <button 
          className="panel-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="toggle-content">
            <Sparkles size={18} />
            <span>AI Assistant</span>
          </div>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      )}

      {(isExpanded || isFloating) && (
        <div className="panel-content">
          {/* Quick Prompts */}
          {messages.length === 0 && (
            <div className="quick-prompts">
              <p className="prompts-label">Quick actions:</p>
              <div className="prompts-grid">
                {QUICK_PROMPTS.map((item, index) => (
                  <button
                    key={index}
                    className="quick-prompt-btn"
                    onClick={() => {
                      setInput(item.prompt);
                      setTimeout(handleSend, 100);
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="messages">
            {messages.map(message => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.role === 'assistant' && (
                  <div className="message-avatar">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="message-content">
                  <p>{message.content}</p>
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="suggestions">
                      {message.suggestions.map((suggestion, index) => (
                        <div key={index} className="suggestion-item">
                          <div className="suggestion-header">
                            <span className="suggestion-icon">
                              {ACTIVITY_ICONS[suggestion.type || 'activity']}
                            </span>
                            <div className="suggestion-info">
                              <span className="suggestion-title">{suggestion.title}</span>
                              <span className="suggestion-meta">
                                {suggestion.startTime && `${suggestion.startTime} · `}
                                {suggestion.duration && formatDuration(suggestion.duration)}
                              </span>
                            </div>
                          </div>
                          {suggestion.description && (
                            <p className="suggestion-desc">{suggestion.description}</p>
                          )}
                          <button
                            className="add-suggestion-btn"
                            onClick={() => handleAddSuggestion(suggestion)}
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </div>
                      ))}
                      
                      {message.suggestions.length > 1 && (
                        <button
                          className="add-all-btn"
                          onClick={() => handleAddAllSuggestions(message.suggestions!)}
                        >
                          <Zap size={14} />
                          Add all to timeline
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Sparkles size={14} />
                </div>
                <div className="message-content loading">
                  <Loader2 size={16} className="spinner" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask AI to plan activities, suggest breaks..."
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ai-panel {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .ai-panel.floating {
          border: none;
          border-radius: 0;
        }

        .ai-panel.floating .panel-content {
          height: auto;
          max-height: 60vh;
        }

        .panel-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 10%, var(--card)),
            color-mix(in srgb, var(--accent) 10%, var(--card))
          );
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .panel-toggle:hover {
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 15%, var(--card)),
            color-mix(in srgb, var(--accent) 15%, var(--card))
          );
        }

        .toggle-content {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--foreground);
        }

        .toggle-content :global(svg) {
          color: var(--primary);
        }

        .panel-content {
          display: flex;
          flex-direction: column;
          height: 400px;
        }

        .quick-prompts {
          padding: 16px;
          border-bottom: 1px solid var(--border);
        }

        .prompts-label {
          font-size: 12px;
          color: var(--muted-foreground);
          margin-bottom: 10px;
        }

        .prompts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .quick-prompt-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--muted);
          border: 1px solid transparent;
          border-radius: 10px;
          font-size: 13px;
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-prompt-btn:hover {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, var(--muted));
        }

        .quick-prompt-btn :global(svg) {
          color: var(--primary);
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          display: flex;
          gap: 10px;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          background: var(--muted);
          border-radius: 12px;
        }

        .message.user .message-content {
          background: var(--primary);
          color: white;
        }

        .message-content p {
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .message-content.loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted-foreground);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .suggestions {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .suggestion-item {
          padding: 12px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          position: relative;
        }

        .suggestion-header {
          display: flex;
          gap: 10px;
          margin-bottom: 4px;
        }

        .suggestion-icon {
          font-size: 18px;
        }

        .suggestion-info {
          flex: 1;
        }

        .suggestion-title {
          font-weight: 600;
          font-size: 13px;
          display: block;
        }

        .suggestion-meta {
          font-size: 11px;
          color: var(--muted-foreground);
        }

        .suggestion-desc {
          font-size: 12px;
          color: var(--muted-foreground);
          margin: 8px 0 0;
        }

        .add-suggestion-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-suggestion-btn:hover {
          opacity: 0.9;
        }

        .add-all-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-all-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .input-area {
          display: flex;
          gap: 10px;
          padding: 16px;
          border-top: 1px solid var(--border);
        }

        .input-area input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 14px;
          background: var(--background);
          color: var(--foreground);
          transition: all 0.2s ease;
        }

        .input-area input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .send-btn {
          width: 44px;
          height: 44px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .send-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .prompts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default AIPanel;
