'use client';

import dynamic from 'next/dynamic';
import { SessionProvider } from 'next-auth/react';
import type { CommitmentCardProps } from './components/CommitmentCard';

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  ),
});

export default function DashboardClientWrapper({
  initialCommitments,
}: {
  initialCommitments: CommitmentCardProps[];
}) {
  return (
    <DashboardClient initialCommitments={initialCommitments} />
  );
}
