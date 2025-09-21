import FirebaseClientInit from '../dashboard/components/FirebaseClientInit';
import '../../../lib/firebase';
import { auth } from '../../../auth';
import { Suspense } from 'react';
import type { CommitmentCardProps } from '../dashboard/components/CommitmentCard';
import { redirect } from 'next/navigation';
import DashboardClientWrapper from './DashboardClientWrapper';

// Server-side data fetching from database
async function getCommitments(): Promise<CommitmentCardProps[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/posts`, {
      cache: 'no-store', // Always fetch fresh data
    });
    
    if (!response.ok) {
      console.error('Failed to fetch posts from database');
      return [];
    }
    
    const posts = await response.json();
    
    // Get session to use profile photo from session data like composer does
    const session = await auth();
    
    // Transform database posts to CommitmentCardProps format
    return posts.map((post: any) => ({
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '', // Remove name display per user request
        username: post.User?.username || 'daniel', // FIXED: Use actual username from database, not name
        avatar: post.User?.profilePhoto || (session?.user as any)?.profilePhoto || (session?.user as any)?.image || '/avatar-placeholder.svg',
        flag: '🇺🇸',
        id: post.userId, // Add the author ID for ownership comparison
      },
      location: {
        zip: '10001',
        city: 'New York',
        state: 'NY',
      },
      stats: {
        likes: Math.floor(Math.random() * 50), // Random likes for demo
        comments: Math.floor(Math.random() * 20),
        reposts: Math.floor(Math.random() * 10),
        views: Math.floor(Math.random() * 200) + 50,
      },
      userVote: null,
      timestamp: post.createdAt,
      imageUrls: post.imageUrls ? (typeof post.imageUrls === 'string' ? JSON.parse(post.imageUrls) : post.imageUrls) : [],
      videoUrl: post.videoUrl || null,
      videoThumbnailUrl: post.videoThumbnailUrl || null,
      audioUrl: post.audioUrl || null,
      audioTranscription: post.audioTranscription || null,
      transcriptionStatus: post.transcriptionStatus || null,
      uploadStatus: 'completed', // Default to completed for existing posts
      uploadProgress: 100, // Default to 100% for existing posts
      gradientFromColor: post.gradientFromColor || null,
      gradientToColor: post.gradientToColor || null,
      gradientViaColor: post.gradientViaColor || null,
      gradientDirection: post.gradientDirection || null,
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export default async function DashboardTestPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const commitments = await getCommitments();

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <div className="min-h-screen bg-white">
        <FirebaseClientInit />
        <DashboardClientWrapper initialCommitments={commitments} />
      </div>
    </Suspense>
  );
}
