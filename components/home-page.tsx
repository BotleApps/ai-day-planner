'use client';

import React, { useState, useEffect } from 'react';
import { Plan } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ImportItineraryModal } from '@/components/import-itinerary-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Compass,
  Sun,
  Moon,
  Monitor,
  Palmtree,
  Mountain,
  Building2,
  Search,
  Trash2,
  MoreVertical,
  Star,
  X,
  FileText,
  Users,
  Share2,
  CheckSquare,
  User,
  Bot,
  LogOut,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { ChecklistList } from './checklist-list';
import { loadAISettings, isAIConfigured } from '@/lib/ai-settings';
import { OnboardingModal } from '@/components/onboarding-modal';

interface HomePageProps {
  onSelectPlan: (planId: string) => void;
  onCreatePlan: () => void;
  onSelectChecklist: (id: string) => void;
  onCreateChecklist: (mode?: 'manual' | 'ai' | 'template') => void;
  onUseTemplate: (templateId: string) => void;
}

const QUICK_TEMPLATES = [
  { id: 'beach', icon: Sun, title: 'Beach Day', emoji: '🏖️', color: '#f97316' },
  { id: 'adventure', icon: Mountain, title: 'Adventure', emoji: '🏔️', color: '#22c55e' },
  { id: 'city', icon: Building2, title: 'City Trip', emoji: '🏙️', color: '#3b82f6' },
  { id: 'relax', icon: Palmtree, title: 'Relaxation', emoji: '🌴', color: '#a855f7' },
];

export function HomePage({ onSelectPlan, onCreatePlan, onSelectChecklist, onCreateChecklist, onUseTemplate }: HomePageProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [sharedPlans, setSharedPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [section, setSection] = useState<'plans' | 'checklists' | 'profile'>('plans');
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProviderLabel, setAiProviderLabel] = useState('AI Provider');

  useEffect(() => {
    setMounted(true);
    const s = loadAISettings();
    setAiConfigured(isAIConfigured(s));
    if (s.provider === 'gemini') setAiProviderLabel('Google Gemini');
    else if (s.provider === 'sap') setAiProviderLabel('SAP AI Core');
    else setAiProviderLabel('AI Provider');
    fetchPlans();
    fetchSharedPlans();
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

  const fetchSharedPlans = async () => {
    try {
      const res = await fetch('/api/plans?tab=shared');
      const data = await res.json();
      setSharedPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching shared plans:', error);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletePlanId) return;
    try {
      await fetch(`/api/plans?id=${deletePlanId}`, { method: 'DELETE' });
      setPlans(plans.filter(p => p._id !== deletePlanId));
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
    setDeletePlanId(null);
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
  const hasAnyPlans = hasPlans || sharedPlans.length > 0;

  const filteredSharedPlans = sharedPlans.filter(plan =>
    plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.destination?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home-container">
      <OnboardingModal />
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <img src="/icons/icon-sorted-plan.svg" alt="SortedPlan" width={32} height={32} />
            </div>
            <span>
              {section === 'plans' ? 'Plans' : section === 'checklists' ? 'Checklists' : 'Profile'}
            </span>
          </div>
          <div className="header-actions">
            {section === 'plans' && hasAnyPlans && (
              <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>
                <Search size={20} />
              </button>
            )}
          </div>
        </div>

        {showSearch && section === 'plans' && (
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

      {/* Section Toggle — REMOVED, replaced by bottom nav */}

      <main className="main-content">
        {section === 'profile' ? (
          <div className="profile-view">
            {/* Avatar hero */}
            <div className="profile-hero">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt={session.user.name ?? 'User'} className="profile-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="profile-avatar-fallback">
                  {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
              <h2 className="profile-name">{session?.user?.name ?? 'User'}</h2>
              <p className="profile-email">{session?.user?.email}</p>
            </div>

            {/* Appearance */}
            <div className="profile-group-label">Appearance</div>
            <div className="profile-group">
              <div className="profile-row no-tap theme-row">
                <div className="profile-row-left">
                  <span className="profile-row-icon" style={{ background: '#f59e0b' }}><Sun size={16} /></span>
                  <span className="profile-row-title">Theme</span>
                </div>
                {mounted && (
                  <div className="theme-pills">
                    {([['light', <Sun size={14} key="s" />, 'Light'], ['dark', <Moon size={14} key="m" />, 'Dark'], ['system', <Monitor size={14} key="mo" />, 'System']] as [string, React.ReactNode, string][]).map(([val, icon, label]) => (
                      <button key={val} className={`theme-pill${theme === val ? ' active' : ''}`} onClick={() => setTheme(val)}>
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Intelligence */}
            <div className="profile-group-label">Intelligence</div>
            <div className="profile-group">
              <button className="profile-row" onClick={() => router.push('/settings/intelligence')}>
                <div className="profile-row-left">
                  <span className="profile-row-icon" style={{ background: aiConfigured ? '#10b981' : '#6366f1' }}>
                    <Bot size={16} />
                  </span>
                  <div className="profile-row-text">
                    <span className="profile-row-title">
                      {aiConfigured ? aiProviderLabel : 'AI Provider'}
                    </span>
                    <span className="profile-row-sub">{aiConfigured ? 'Connected' : 'Not configured'}</span>
                  </div>
                </div>
                <div className="profile-row-right">
                  {aiConfigured && (
                    <span className="badge-ok"><CheckCircle2 size={11} />Connected</span>
                  )}
                  <ChevronRight size={16} className="chevron" />
                </div>
              </button>
            </div>

            {/* Sign out */}
            <div className="profile-group-label">Account</div>
            <div className="profile-group">
              <button className="profile-row danger-row" onClick={() => signOut({ callbackUrl: '/sign-in' })}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        ) : section === 'checklists' ? (
          <div className="plans-view">
            <ChecklistList
              onSelectChecklist={onSelectChecklist}
              onCreateChecklist={onCreateChecklist}
              onUseTemplate={onUseTemplate}
            />
          </div>
        ) : isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your plans...</p>
          </div>
        ) : !hasAnyPlans ? (
          /* Empty State - Clean and Inviting */
          <div className="empty-state">
            <div className="empty-illustration">
              <Compass size={64} strokeWidth={1} />
            </div>
            <h1>Plan Your Perfect Day</h1>
            <p>Create AI-powered itineraries for holidays, trips, and special events</p>

            <div className="empty-actions">
              <button className="primary-btn large" onClick={onCreatePlan}>
                <Plus size={22} />
                Create Your First Plan
              </button>
              <button className="import-btn large" onClick={() => setShowImport(true)}>
                <FileText size={18} />
                Import Itinerary
              </button>
            </div>

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
          /* Plans List with Tabs */
          <div className="plans-view">
            {/* Tab bar */}
            <div className="tabs-bar">
              <button
                className={`tab-btn${tab === 'mine' ? ' active' : ''}`}
                onClick={() => setTab('mine')}
              >
                Mine
                {plans.length > 0 && <span className="tab-badge">{plans.length}</span>}
              </button>
              <button
                className={`tab-btn${tab === 'shared' ? ' active' : ''}`}
                onClick={() => setTab('shared')}
              >
                <Users size={14} />
                Shared
                {sharedPlans.length > 0 && <span className="tab-badge">{sharedPlans.length}</span>}
              </button>
            </div>

            {tab === 'mine' ? (
              <>
                <div className="plans-header">
                  <div className="plans-header-actions">
                    <button className="primary-btn compact" onClick={onCreatePlan}>
                      <Plus size={18} />
                      <span>New</span>
                    </button>
                    <button className="import-btn" onClick={() => setShowImport(true)}>
                      <FileText size={16} />
                      <span>Import</span>
                    </button>
                  </div>
                </div>

                {filteredPlans.length === 0 && searchQuery ? (
                  <div className="no-results">
                    <p>No plans match &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery('')}>Clear search</button>
                  </div>
                ) : filteredPlans.length === 0 ? (
                  <div className="tab-empty">
                    <Compass size={40} strokeWidth={1} />
                    <p>No plans yet</p>
                    <button className="primary-btn compact" onClick={onCreatePlan}>
                      <Plus size={16} /> Create a plan
                    </button>
                  </div>
                ) : (
                  <div className="plans-list">
                    {filteredPlans.map(plan => (
                      <div
                        key={plan._id}
                        className={`plan-card${menuPlanId === plan._id ? ' menu-open' : ''}`}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletePlanId(plan._id!);
                                setMenuPlanId(null);
                              }}
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
              </>
            ) : (
              /* Shared with Me tab */
              <>
                {filteredSharedPlans.length === 0 && searchQuery ? (
                  <div className="no-results">
                    <p>No shared plans match &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery('')}>Clear search</button>
                  </div>
                ) : filteredSharedPlans.length === 0 ? (
                  <div className="tab-empty">
                    <Share2 size={40} strokeWidth={1} />
                    <p>No shared plans yet</p>
                    <span className="tab-empty-hint">Open a shared link to see plans here</span>
                  </div>
                ) : (
                  <div className="plans-list">
                    {filteredSharedPlans.map(plan => (
                      <div
                        key={plan._id}
                        className="plan-card shared-card"
                        onClick={() => onSelectPlan(plan._id!)}
                      >
                        <div className="plan-card-main">
                          <div className="plan-info">
                            <div className="shared-badge-row">
                              <div className="shared-badge">
                                <Share2 size={11} />
                                Shared with you
                              </div>
                              {(plan as any).userPermission === 'edit' ? (
                                <span className="shared-perm-badge edit">✏️ Can edit</span>
                              ) : (
                                <span className="shared-perm-badge view">👁 View only</span>
                              )}
                            </div>
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Import Itinerary Modal */}
      <ImportItineraryModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onPlanCreated={(planId) => {
          setShowImport(false);
          fetchPlans();
          onSelectPlan(planId);
        }}
      />

      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        open={!!deletePlanId}
        title="Delete Plan"
        message={`Delete "${plans.find(p => p._id === deletePlanId)?.title ?? 'this plan'}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeletePlan}
        onCancel={() => setDeletePlanId(null)}
      />

      {/* Click outside to close menu */}
      {menuPlanId && (
        <div
          className="menu-overlay"
          onClick={() => setMenuPlanId(null)}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`nav-item${section === 'plans' ? ' active' : ''}`} onClick={() => setSection('plans')}>
          <Compass size={22} />
          <span>Plans</span>
        </button>
        <button className={`nav-item${section === 'checklists' ? ' active' : ''}`} onClick={() => setSection('checklists')}>
          <CheckSquare size={22} />
          <span>Checklists</span>
        </button>
        <button className={`nav-item${section === 'profile' ? ' active' : ''}`} onClick={() => setSection('profile')}>
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className={`nav-avatar${section === 'profile' ? ' nav-avatar-active' : ''}`} referrerPolicy="no-referrer" />
          ) : (
            <User size={22} />
          )}
          <span>Profile</span>
        </button>
      </nav>

      <style jsx>{`
        .home-container {
          height: 100dvh;
          background: var(--background);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
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
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .logo-icon img { width: 100%; height: 100%; object-fit: cover; }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-btn {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: all 0.2s;
        }
        .icon-btn:hover {
          background: var(--muted);
          color: var(--foreground);
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid var(--border);
          object-fit: cover;
        }

        .avatar-fallback {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
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
          font-size: 16px; /* Prevents iOS auto-zoom */
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
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
          min-height: 0;
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
          width: 100%;
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
          margin-bottom: 28px;
        }

        .empty-actions {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
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

        .import-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          background: transparent;
          color: var(--foreground);
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .import-btn.large {
          width: 100%;
          padding: 14px 24px;
          font-size: 16px;
          border-radius: 14px;
        }

        .import-btn:hover {
          background: var(--muted);
          border-color: var(--primary);
          color: var(--primary);
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
          padding: 0 16px;
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
        }

        /* Tabs */
        .tabs-bar {
          display: flex;
          gap: 4px;
          padding: 12px 0 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          background: var(--card);
          border-top: 1px solid var(--border);
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 8px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--muted-foreground);
          font-size: 11px;
          font-weight: 500;
          transition: color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-item.active {
          color: var(--primary);
        }

        .nav-item span {
          letter-spacing: 0.01em;
        }

        .nav-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid transparent;
        }
        .nav-avatar-active {
          border-color: var(--primary);
        }

        /* Profile section */
        .profile-view {
          max-width: 540px;
          width: 100%;
          margin: 0 auto;
          padding: 0 20px 32px;
        }

        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 36px 20px 28px;
          gap: 8px;
        }

        .profile-avatar {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--border);
          margin-bottom: 4px;
        }

        .profile-avatar-fallback {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .profile-name {
          font-size: 20px;
          font-weight: 700;
          color: var(--foreground);
          margin: 0;
        }

        .profile-email {
          font-size: 13px;
          color: var(--muted-foreground);
          margin: 0;
        }

        .profile-group-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          padding: 0 4px 8px;
          margin-top: 20px;
        }

        .profile-group {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .profile-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .profile-row:hover { background: var(--muted); }
        .profile-row.no-tap { cursor: default; }
        .profile-row.no-tap:hover { background: transparent; }

        .profile-row-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .profile-row-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .profile-row-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .profile-row-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
        }

        .profile-row-sub {
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .profile-row-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .chevron { color: var(--muted-foreground); }

        .badge-ok {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: color-mix(in srgb, #10b981 15%, var(--card));
          color: #059669;
          border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }

        .danger-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          width: 100%;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #ef4444;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .danger-row:hover { background: color-mix(in srgb, #ef4444 8%, var(--card)); }

        /* Theme pills (profile) */
        .profile-row.no-tap.theme-row {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }
        .theme-pills {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .theme-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 8px 10px;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          background: var(--background);
          color: var(--muted-foreground);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .theme-pill:hover { border-color: var(--primary); color: var(--foreground); }
        .theme-pill.active {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 12%, var(--background));
          color: var(--primary);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          background: none;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted-foreground);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          border-radius: 8px 8px 0 0;
          transition: color 0.15s;
        }

        .tab-btn:hover {
          color: var(--foreground);
          background: var(--muted);
        }

        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: transparent;
        }

        .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: var(--muted);
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-foreground);
        }

        .tab-btn.active .tab-badge {
          background: color-mix(in srgb, var(--primary) 15%, transparent);
          color: var(--primary);
        }

        .plans-header {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 12px 16px;
          gap: 8px;
        }

        .plans-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Tab empty state */
        .tab-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 24px;
          gap: 12px;
          color: var(--muted-foreground);
          text-align: center;
        }

        .tab-empty p {
          font-size: 15px;
          font-weight: 500;
          color: var(--foreground);
          margin: 0;
        }

        .tab-empty-hint {
          font-size: 13px;
          color: var(--muted-foreground);
        }

        /* Shared badge on plan card */
        .shared-badge-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }

        .shared-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, transparent);
          border-radius: 6px;
          padding: 2px 7px;
        }

        .shared-perm-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 6px;
        }

        .shared-perm-badge.view {
          background: color-mix(in srgb, #6366f1 12%, transparent);
          color: #6366f1;
        }

        .shared-perm-badge.edit {
          background: color-mix(in srgb, #f59e0b 12%, transparent);
          color: #d97706;
        }

        .shared-card {
          cursor: pointer;
        }

        .shared-card:hover {
          border-color: var(--primary);
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
          padding: 0 16px 16px;
        }

        .plan-card {
          position: relative;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .plan-card:hover {
          border-color: var(--primary);
        }

        .plan-card:active {
          opacity: 0.95;
        }

        .plan-card.menu-open {
          z-index: 30;
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
          z-index: 50;
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
          .empty-state {
            padding: 24px 20px;
            justify-content: flex-start;
            padding-top: 40px;
          }

          .empty-illustration {
            width: 100px;
            height: 100px;
            margin-bottom: 20px;
          }

          .empty-state h1 {
            font-size: 22px;
          }

          .empty-state > p {
            font-size: 14px;
            margin-bottom: 24px;
          }

          .primary-btn.large {
            padding: 15px 20px;
            font-size: 15px;
          }

          .import-btn.large {
            padding: 13px 20px;
            font-size: 15px;
          }

          .template-chips {
            gap: 8px;
          }

          .template-chip {
            padding: 9px 13px;
            font-size: 13px;
          }

          .plans-view {
            padding: 0;
          }

          .tabs-bar {
            padding: 10px 12px 0;
          }

          .tab-btn {
            padding: 7px 10px;
            font-size: 13px;
          }

          .plans-header {
            padding: 10px 12px;
          }

          .primary-btn.compact,
          .import-btn:not(.large) {
            padding: 9px 12px;
            font-size: 14px;
          }

          .plans-list {
            padding: 0 12px 12px;
            gap: 10px;
          }

          .plan-card {
            padding: 14px;
            border-radius: 14px;
          }

          .plan-card-footer {
            flex-direction: row;
            align-items: center;
          }

          .progress-bar {
            width: 40px;
          }
        }

        @media (max-width: 360px) {
          .header-content {
            padding: 10px 12px;
          }

          .logo {
            font-size: 16px;
          }

          .tab-btn {
            padding: 6px 8px;
            font-size: 12px;
            gap: 4px;
          }

          .plans-header {
            padding: 8px 10px;
          }

          .plans-list {
            padding: 0 10px 10px;
          }

          .primary-btn.compact span,
          .import-btn:not(.large) span {
            display: none;
          }

          .primary-btn.compact,
          .import-btn:not(.large) {
            padding: 9px;
            min-width: 36px;
            border-radius: 10px;
          }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
