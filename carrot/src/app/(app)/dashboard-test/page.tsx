'use client';

import { Suspense } from 'react';
import DashboardClientWrapper from './DashboardClientWrapper';

function DashboardContent() {
  return <DashboardClientWrapper />;
}

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  );
}

export default function DashboardTestPage() {
  return (
    <div className="dashboard-test-page">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
