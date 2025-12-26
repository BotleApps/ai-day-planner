'use client';

import React from 'react';
import { DayPlan, Plan } from '@/lib/types';
import { formatDate, getDayOfWeek, calculateDayProgress, cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, Sun, Cloud, CloudRain, Snowflake } from 'lucide-react';

interface DaySelectorProps {
  plan: Plan;
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DaySelector({ plan, selectedDayId, onSelectDay }: DaySelectorProps) {
  const selectedIndex = plan.days.findIndex(d => d.id === selectedDayId);
  
  const scrollContainer = React.useRef<HTMLDivElement>(null);

  const scrollToDay = (direction: 'prev' | 'next') => {
    if (!scrollContainer.current) return;
    const scrollAmount = 200;
    scrollContainer.current.scrollBy({
      left: direction === 'prev' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return null;
    const lower = condition.toLowerCase();
    if (lower.includes('rain')) return <CloudRain size={16} />;
    if (lower.includes('cloud')) return <Cloud size={16} />;
    if (lower.includes('snow')) return <Snowflake size={16} />;
    return <Sun size={16} />;
  };

  return (
    <div className="day-selector">
      <button 
        className="scroll-btn prev"
        onClick={() => scrollToDay('prev')}
        disabled={selectedIndex === 0}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="days-container" ref={scrollContainer}>
        {plan.days.map((day, index) => {
          const progress = calculateDayProgress(day);
          const isSelected = day.id === selectedDayId;
          const isToday = day.date === new Date().toISOString().split('T')[0];
          
          return (
            <button
              key={day.id}
              className={cn(
                'day-card',
                isSelected && 'selected',
                isToday && 'today'
              )}
              onClick={() => onSelectDay(day.id)}
            >
              <div className="day-number">Day {day.dayNumber}</div>
              <div className="day-date">{formatDate(day.date)}</div>
              <div className="day-weekday">{getDayOfWeek(day.date)}</div>
              
              {day.title && (
                <div className="day-title">{day.title}</div>
              )}

              {day.weather && (
                <div className="day-weather">
                  {getWeatherIcon(day.weather.condition)}
                  <span>{day.weather.temperature}°</span>
                </div>
              )}

              <div className="day-progress">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="day-stats">
                {progress.completed}/{progress.total} activities
              </div>

              {isToday && <div className="today-badge">Today</div>}
            </button>
          );
        })}
      </div>

      <button 
        className="scroll-btn next"
        onClick={() => scrollToDay('next')}
        disabled={selectedIndex === plan.days.length - 1}
      >
        <ChevronRight size={20} />
      </button>

      <style jsx>{`
        .day-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 0;
        }

        .scroll-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .scroll-btn:hover:not(:disabled) {
          background: var(--muted);
          border-color: var(--primary);
        }

        .scroll-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .days-container {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          scroll-behavior: smooth;
          padding: 4px;
          flex: 1;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .days-container::-webkit-scrollbar {
          display: none;
        }

        .day-card {
          position: relative;
          min-width: 140px;
          padding: 16px;
          background: var(--card);
          border: 2px solid var(--border);
          border-radius: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .day-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .day-card.selected {
          border-color: var(--primary);
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--primary) 5%, var(--card)),
            color-mix(in srgb, var(--accent) 5%, var(--card))
          );
          box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        .day-card.today {
          border-color: var(--accent);
        }

        .day-number {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--primary);
          margin-bottom: 4px;
        }

        .day-date {
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
        }

        .day-weekday {
          font-size: 12px;
          color: var(--muted-foreground);
          margin-bottom: 8px;
        }

        .day-title {
          font-size: 11px;
          font-weight: 500;
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, transparent);
          padding: 4px 8px;
          border-radius: 6px;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .day-weather {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted-foreground);
          margin-bottom: 8px;
        }

        .day-progress {
          height: 4px;
          background: var(--muted);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .progress-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .day-stats {
          font-size: 10px;
          color: var(--muted-foreground);
        }

        .today-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--accent);
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

export default DaySelector;
