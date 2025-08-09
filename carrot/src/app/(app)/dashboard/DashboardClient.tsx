'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import CommitmentCard, { CommitmentCardProps, VoteType } from './components/CommitmentCard';
import CommitmentComposer from './components/CommitmentComposer';

export interface DashboardCommitmentCardProps extends Omit<CommitmentCardProps, 'onVote' | 'onToggleBookmark'> {
  // Add any additional props specific to Dashboard if needed
}

interface DashboardClientProps {
  initialCommitments: DashboardCommitmentCardProps[];
}



import { useSyncFirebaseAuth } from '../../../lib/useSyncFirebaseAuth';

export default function DashboardClient({ initialCommitments }: DashboardClientProps) {
  useSyncFirebaseAuth();
  const [commitments, setCommitments] = useState<DashboardCommitmentCardProps[]>(initialCommitments);
  const { data: session } = useSession();
  const router = useRouter();

  const handleVote = (id: string, vote: VoteType) => {
    setCommitments(prevCommitments =>
      prevCommitments.map(commitment =>
        commitment.id === id
          ? {
              ...commitment,
              stats: {
                ...commitment.stats,
                likes: vote === 'carrot' ? (commitment.stats.likes || 0) + 1 : (commitment.stats.likes || 0),
              },
              userVote: vote,
            }
          : commitment
      )
    );
  };
  
  // Wrapper function to handle the vote event from CommitmentCard
  const handleVoteWrapper = (id: string, vote: VoteType) => {
    handleVote(id, vote);
  };

  const handleCreateCommitment = (post: any) => {
    // Accept full post object from CommitmentComposer (optimistic UI)
    setCommitments(prev => [post, ...prev]);
  };


  const handleToggleBookmark = (id: string) => {
    console.log(`Toggled bookmark on commitment ${id}`);
    // TODO: Implement bookmark logic
  };

  return (
    <div className="dashboard-feed-root">
      <div className="w-full max-w-[800px] mx-auto px-4 pt-[50px]">
        <CommitmentComposer onPost={handleCreateCommitment} />
        {/* Professional compact spacing for social media feed */}
        <div className="space-y-3 mt-6">
          {commitments.map((commitment) => (
            <CommitmentCard
              key={commitment.id}
              {...commitment}
              onVote={(vote) => handleVote(commitment.id, vote as VoteType)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
