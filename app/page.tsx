'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import HomePage from '@/components/home-page';
import PlanView from '@/components/plan-view';
import CreatePlanModal from '@/components/create-plan-modal';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Handle URL-based plan selection
  useEffect(() => {
    const planId = searchParams.get('plan');
    const shareLink = searchParams.get('share');
    
    if (planId) {
      setSelectedPlanId(planId);
    } else if (shareLink) {
      // Fetch plan by share link
      fetch(`/api/plans?shareLink=${shareLink}`)
        .then(res => res.json())
        .then(data => {
          if (data.plan) {
            setSelectedPlanId(data.plan._id);
          }
        })
        .catch(console.error);
    }
  }, [searchParams]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    router.push(`/?plan=${planId}`);
  };

  const handleBackToHome = () => {
    setSelectedPlanId(null);
    router.push('/');
  };

  const handleCreatePlan = () => {
    setShowCreateModal(true);
  };

  const handlePlanCreated = (planId: string) => {
    setShowCreateModal(false);
    handleSelectPlan(planId);
  };

  // Show plan view if a plan is selected
  if (selectedPlanId) {
    return (
      <PlanView
        planId={selectedPlanId}
        onBack={handleBackToHome}
      />
    );
  }

  // Show home page with plan list
  return (
    <>
      <HomePage
        onSelectPlan={handleSelectPlan}
        onCreatePlan={handleCreatePlan}
      />
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlanCreated={handlePlanCreated}
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
          <p className="mt-4 text-muted-foreground font-medium">Loading AI Day Planner...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
