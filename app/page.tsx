'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LandingPage } from '@/components/landing-page';
import { MobileWelcome } from '@/components/mobile-welcome';
import { useIsNative } from '@/lib/use-is-native';
import HomePage from '@/components/home-page';
import PlanView from '@/components/plan-view';
import ChecklistDetail from '@/components/checklist-detail';
import CreatePlanModal from '@/components/create-plan-modal';
import CreateChecklistModal from '@/components/create-checklist-modal';

function HomeContent() {
  const { status } = useSession();
  const isNative = useIsNative();
  // Logged-out entry screen: native gets the app intro/onboarding + login,
  // the browser gets the marketing landing page.
  const welcome = isNative ? <MobileWelcome /> : <LandingPage />;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [checklistShareToken, setChecklistShareToken] = useState<string | null>(null);
  const [showCreateChecklistModal, setShowCreateChecklistModal] = useState(false);
  const [createChecklistMode, setCreateChecklistMode] = useState<'manual' | 'ai' | 'template' | undefined>();
  const [useTemplateId, setUseTemplateId] = useState<string | undefined>();
  useEffect(() => {
    const planId = searchParams.get('plan');
    const shareLink = searchParams.get('share');
    const checklistId = searchParams.get('checklist');
    const cshare = searchParams.get('cshare');

    if (planId) {
      setSelectedPlanId(planId);
      setShareToken(null);
      setSelectedChecklistId(null);
      setChecklistShareToken(null);
    } else if (shareLink) {
      setShareToken(shareLink);
      setSelectedPlanId(null);
      setSelectedChecklistId(null);
      setChecklistShareToken(null);
    } else if (checklistId) {
      setSelectedChecklistId(checklistId);
      setChecklistShareToken(null);
      setSelectedPlanId(null);
      setShareToken(null);
    } else if (cshare) {
      setChecklistShareToken(cshare);
      setSelectedChecklistId(null);
      setSelectedPlanId(null);
      setShareToken(null);
    }
  }, [searchParams]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    router.push(`/?plan=${planId}`);
  };

  const handleBackToHome = () => {
    setSelectedPlanId(null);
    setShareToken(null);
    setSelectedChecklistId(null);
    setChecklistShareToken(null);
    router.push('/');
  };

  const handleSelectChecklist = (checklistId: string) => {
    setSelectedChecklistId(checklistId);
    router.push(`/?checklist=${checklistId}`);
  };

  const handleChecklistCreated = (checklistId: string) => {
    setShowCreateChecklistModal(false);
    setCreateChecklistMode(undefined);
    setUseTemplateId(undefined);
    handleSelectChecklist(checklistId);
  };

  if (selectedPlanId || shareToken) {
    // Share links work without auth
    if (status === 'unauthenticated' && !shareToken) return welcome;
    return (
      <PlanView
        planId={selectedPlanId ?? ''}
        shareToken={shareToken ?? undefined}
        onBack={handleBackToHome}
      />
    );
  }

  if (selectedChecklistId || checklistShareToken) {
    if (status === 'unauthenticated' && !checklistShareToken) return welcome;
    return (
      <ChecklistDetail
        checklistId={selectedChecklistId ?? undefined}
        shareToken={checklistShareToken ?? undefined}
        onBack={handleBackToHome}
      />
    );
  }

  // Show the appropriate logged-out entry screen (web landing vs native intro)
  if (status === 'loading') return null;
  if (status === 'unauthenticated') return welcome;

  return (
    <>
      <HomePage
        onSelectPlan={handleSelectPlan}
        onCreatePlan={() => setShowCreateModal(true)}
        onSelectChecklist={handleSelectChecklist}
        onCreateChecklist={(mode) => { setCreateChecklistMode(mode); setShowCreateChecklistModal(true); }}
        onUseTemplate={(templateId) => { setUseTemplateId(templateId); setCreateChecklistMode('template'); setShowCreateChecklistModal(true); }}
      />
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlanCreated={(planId) => {
          setShowCreateModal(false);
          handleSelectPlan(planId);
        }}
      />
      <CreateChecklistModal
        isOpen={showCreateChecklistModal}
        onClose={() => { setShowCreateChecklistModal(false); setCreateChecklistMode(undefined); setUseTemplateId(undefined); }}
        onCreated={handleChecklistCreated}
        initialMode={createChecklistMode}
        initialTemplateId={useTemplateId}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="relative inline-block">
            <div className="h-12 w-12 rounded-full border-4 border-indigo-200 dark:border-indigo-900" />
            <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          </div>
          <p className="mt-4 text-muted-foreground font-medium">Loading SortedPlan...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

