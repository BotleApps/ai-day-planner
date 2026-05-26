'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, DayPlan, PlanPreferences, ACTIVITY_ICONS } from '@/lib/types';
import { generateId, formatDuration } from '@/lib/utils';
import { loadAISettings, loadAISettingsFromServer, saveAISettings, isAIConfigured } from '@/lib/ai-settings';
import {
  Sparkles,
  Send,
  Loader2,
  Wand2,
  Clock,
  MapPin,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Plus,
  Zap,
  Settings,
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
  onSuggestChange: _onSuggestChange,
  isFloating = false,
}: AIPanelProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = loadAISettings();
    setAiConfigured(isAIConfigured(local));
    loadAISettingsFromServer().then(serverSettings => {
      saveAISettings(serverSettings);
      setAiConfigured(isAIConfigured(serverSettings));
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const callAI = async (prompt: string): Promise<{ message: string; suggestions: Partial<Activity>[] }> => {
    const settings = loadAISettings();

    if (!isAIConfigured(settings)) {
      throw new Error('not_configured');
    }

    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        settings,
        context: {
          destination,
          date: day.date,
          preferences,
          activities: day.activities,
        },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }

    return {
      message: data.message || 'Here are some suggestions:',
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
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
    const sentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await callAI(sentInput);
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          suggestions: response.suggestions,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      const isNotConfigured = error instanceof Error && error.message === 'not_configured';
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: isNotConfigured
            ? 'AI is not configured. Go to Settings → Intelligence to set up your AI provider.'
            : `Sorry, I couldn't get a response. ${error instanceof Error ? error.message : 'Please try again.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    // Use a small delay so the input value is set before handleSend reads it
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: generateId(), role: 'user', content: prompt, timestamp: new Date() },
      ]);
      setInput('');
      setIsLoading(true);

      callAI(prompt)
        .then(response => {
          setMessages(prev => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: response.message,
              suggestions: response.suggestions,
              timestamp: new Date(),
            },
          ]);
        })
        .catch(error => {
          const isNotConfigured = error instanceof Error && error.message === 'not_configured';
          setMessages(prev => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: isNotConfigured
                ? 'AI is not configured. Go to Settings → Intelligence to set up your AI provider.'
                : `Sorry, I couldn't get a response. ${error instanceof Error ? error.message : 'Please try again.'}`,
              timestamp: new Date(),
            },
          ]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 50);
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
            {!aiConfigured && (
              <span className="unconfigured-badge">Not configured</span>
            )}
          </div>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      )}

      {(isExpanded || isFloating) && (
        <div className="panel-content">
          {/* Not-configured banner */}
          {!aiConfigured && (
            <div className="config-banner">
              <Sparkles size={15} />
              <span>Connect an AI provider to enable real intelligence.</span>
              <button className="config-link" onClick={() => router.push('/settings')}>
                <Settings size={13} />
                Settings
              </button>
            </div>
          )}

          {/* Quick Prompts */}
          {messages.length === 0 && (
            <div className="quick-prompts">
              <p className="prompts-label">Quick actions:</p>
              <div className="prompts-grid">
                {QUICK_PROMPTS.map((item, index) => (
                  <button
                    key={index}
                    className="quick-prompt-btn"
                    onClick={() => handleQuickPrompt(item.prompt)}
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

        .unconfigured-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          background: color-mix(in srgb, #f59e0b 20%, var(--card));
          color: #d97706;
          border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
          border-radius: 999px;
        }

        .config-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: color-mix(in srgb, var(--primary) 8%, var(--card));
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          color: var(--foreground);
        }

        .config-banner :global(svg) {
          color: var(--primary);
          flex-shrink: 0;
        }

        .config-banner span {
          flex: 1;
        }

        .config-link {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.2s;
        }

        .config-link:hover {
          opacity: 0.9;
        }

        .panel-content {
          display: flex;
          flex-direction: column;
          height: 400px;
        }

        @media (max-width: 480px) {
          .panel-content {
            height: 55vh;
          }
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
          max-width: 85%;
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

          .quick-prompt-btn {
            padding: 12px 14px;
            font-size: 14px;
          }

          .input-area input {
            font-size: 16px; /* Prevents iOS zoom on focus */
          }

          .config-banner {
            flex-wrap: wrap;
            gap: 6px;
          }
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .input-area {
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}

export default AIPanel;
