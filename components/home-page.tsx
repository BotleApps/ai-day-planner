'use client';

import React, { useState, useEffect } from 'react';
import { Plan } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Compass,
  Sun,
  Palmtree,
  Mountain,
  Building2,
  Search,
  Trash2,
  MoreVertical,
  Star,
  X,
} from 'lucide-react';

interface HomePageProps {
  onSelectPlan: (planId: string) => void;
  onCreatePlan: () => void;
}

const QUICK_TEMPLATES = [
  { id: 'beach', icon: Sun, title: 'Beach Day', emoji: '🏖️', color: '#f97316' },
  { id: 'adventure', icon: Mountain, title: 'Adventure', emoji: '🏔️', color: '#22c55e' },
  { id: 'city', icon: Building2, title: 'City Trip', emoji: '🏙️', color: '#3b82f6' },
  { id: 'relax', icon: Palmtree, title: 'Relaxation', emoji: '🌴', color: '#a855f7' },
];

export function HomePage({ onSelectPlan, onCreatePlan }: HomePageProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this plan?')) return;
    
    try {
      await fetch(`/api/plans?id=${planId}`, { method: 'DELETE' });
      setPlans(plans.filter(p => p._id !== planId));
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
    setMenuPlanId(null);
  };

  const filteredPlans = plans.filter(plan => 
    plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.destination?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanProgress = (plan: Plan) => {
    const total = plan.days.reduce((sum, day) => sum + day.activities.length, 0);
    const done = plan.days.reduce((sum, day) => 
      sum + day.activities.filter(a => a.status === 'completed').length, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const hasPlans = plans.length > 0;

  return (
    <div className="home-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <Sparkles size={20} />
            </div>
            <span>Day Planner</span>
          </div>
          <div className="header-actions">
            {hasPlans && (
              <button 
                className="icon-btn"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search size={20} />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
        
        {showSearch && (
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search plans..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </header>

      <main className="main-content">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your plans...</p>
          </div>
        ) : !hasPlans ? (
          /* Empty State - Clean and Inviting */
          <div className="empty-state">
            <div className="empty-illustration">
              <Compass size={64} strokeWidth={1} />
            </div>
            <h1>Plan Your Perfect Day</h1>
            <p>Create AI-powered itineraries for holidays, trips, and special events</p>
            
            <button className="primary-btn large" onClick={onCreatePlan}>
              <Plus size={22} />
              Create Your First Plan
            </button>

            <div className="quick-start">
              <span className="divider-text">or quick start with</span>
              <div className="template-chips">
                {QUICK_TEMPLATES.map(t => (
                  <button 
                    key={t.id}
                    className="template-chip"
                    onClick={onCreatePlan}
                    style={{ '--chip-color': t.color } as React.CSSProperties}
                  >
                    <span className="chip-emoji">{t.emoji}</span>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Plans List */
          <div className="plans-view">
            <div className="plans-header">
              <h2>Your Plans</h2>
              <button className="primary-btn compact" onClick={onCreatePlan}>
                <Plus size={18} />
                <span>New</span>
              </button>
            </div>

            {filteredPlans.length === 0 ? (
              <div className="no-results">
                <p>No plans match &ldquo;{searchQuery}&rdquo;</p>
                <button onClick={() => setSearchQuery('')}>Clear search</button>
              </div>
            ) : (
              <div className="plans-list">
                {filteredPlans.map(plan => (
                  <div
                    key={plan._id}
                    className="plan-card"
                    onClick={() => onSelectPlan(plan._id!)}
                  >
                    <div className="plan-card-main">
                      <div className="plan-info">
                        <h3>{plan.title}</h3>
                        {plan.destination && (
                          <div className="plan-meta">
                            <MapPin size={14} />
                            <span>{plan.destination}</span>
                          </div>
                        )}
                        <div className="plan-meta">
                          <Calendar size={14} />
                          <span>
                            {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        className="menu-trigger"
                        onClick={e => {
                          e.stopPropagation();
                          setMenuPlanId(menuPlanId === plan._id ? null : plan._id!);
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    <div className="plan-card-footer">
                      <div className="plan-stats">
                        <span className="stat">
                          <Clock size={13} />
                          {plan.days.length} day{plan.days.length !== 1 ? 's' : ''}
                        </span>
                        <span className="stat">
                          <Star size={13} />
                          {plan.days.reduce((s, d) => s + d.activities.length, 0)} activities
                        </span>
                      </div>
                      
                      <div className="progress-indicator">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${getPlanProgress(plan)}%` }}
                          />
                        </div>
                        <span className="progress-text">{getPlanProgress(plan)}%</span>
                      </div>
                    </div>

                    {menuPlanId === plan._id && (
                      <div className="plan-menu" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { onSelectPlan(plan._id!); setMenuPlanId(null); }}>
                          Open Plan
                        </button>
                        <button 
                          className="danger"
                          onClick={(e) => handleDeletePlan(plan._id!, e)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </main>

      {/* Click outside to close menu */}
      {menuPlanId && (
        <div 
          className="menu-overlay" 
          onClick={() => setMenuPlanId(null)} 
        />
      )}

      <style jsx>{`
        .home-container {
          min-height: 100dvh;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--background);
          border-bottom: 1px solid var(--border);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          max-width: 600px;
          margin: 0 auto;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 700;
        }

        .logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          background: var(--muted);
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-btn:hover {
          background: var(--border);
          color: var(--foreground);
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          margin: 0 16px 12px;
          background: var(--muted);
          border-radius: 12px;
          max-width: 568px;
          margin-left: auto;
          margin-right: auto;
        }

        .search-bar :global(svg) {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }

        .search-bar input {
          flex: 1;
          border: none;
          background: none;
          font-size: 15px;
          color: var(--foreground);
          outline: none;
        }

        .search-bar button {
          padding: 4px;
          border: none;
          background: none;
          color: var(--muted-foreground);
          cursor: pointer;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* Loading State */
        .loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-state p {
          color: var(--muted-foreground);
        }

        /* Empty State */
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          text-align: center;
          max-width: 400px;
          margin: 0 auto;
        }

        .empty-illustration {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, 
            color-mix(in srgb, var(--primary) 15%, transparent),
            color-mix(in srgb, var(--accent) 10%, transparent)
          );
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--primary);
        }

        .empty-state h1 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .empty-state > p {
          color: var(--muted-foreground);
          font-size: 15px;
          line-height: 1.5;
          margin-bottom: 32px;
        }

        .primary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .primary-btn.large {
          width: 100%;
          padding: 16px 24px;
          font-size: 16px;
        }

        .primary-btn.compact {
          padding: 10px 16px;
          border-radius: 12px;
        }

        .primary-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .primary-btn:active {
          transform: translateY(0);
        }

        .quick-start {
          width: 100%;
          margin-top: 32px;
        }

        .divider-text {
          display: block;
          text-align: center;
          font-size: 13px;
          color: var(--muted-foreground);
          margin-bottom: 16px;
        }

        .template-chips {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .template-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 100px;
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.2s;
        }

        .template-chip:hover {
          border-color: var(--chip-color);
          background: color-mix(in srgb, var(--chip-color) 8%, transparent);
        }

        .chip-emoji {
          font-size: 16px;
        }

        /* Plans View */
        .plans-view {
          flex: 1;
          padding: 16px;
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
        }

        .plans-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .plans-header h2 {
          font-size: 20px;
          font-weight: 700;
        }

        .no-results {
          text-align: center;
          padding: 48px 24px;
          color: var(--muted-foreground);
        }

        .no-results button {
          margin-top: 12px;
          padding: 8px 16px;
          background: var(--muted);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          color: var(--foreground);
          cursor: pointer;
        }

        .plans-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .plan-card {
          position: relative;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .plan-card:hover {
          border-color: var(--primary);
        }

        .plan-card:active {
          transform: scale(0.99);
        }

        .plan-card-main {
          display: flex;
          gap: 12px;
        }

        .plan-info {
          flex: 1;
          min-width: 0;
        }

        .plan-info h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .plan-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--muted-foreground);
          margin-bottom: 4px;
        }

        .plan-meta :global(svg) {
          flex-shrink: 0;
        }

        .plan-meta span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .menu-trigger {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .menu-trigger:hover {
          background: var(--muted);
        }

        .plan-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .plan-stats {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .progress-bar {
          width: 48px;
          height: 4px;
          background: var(--muted);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          transition: width 0.3s;
        }

        .progress-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-foreground);
          min-width: 28px;
        }

        .plan-menu {
          position: absolute;
          top: 56px;
          right: 16px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          min-width: 140px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          z-index: 20;
        }

        .plan-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: none;
          font-size: 14px;
          color: var(--foreground);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        }

        .plan-menu button:hover {
          background: var(--muted);
        }

        .plan-menu button.danger {
          color: #ef4444;
        }

        .plan-menu button.danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 10;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .templates-row {
            grid-template-columns: repeat(2, 1fr);
          }

          .plan-card-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .progress-indicator {
            width: 100%;
          }

          .progress-bar {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
