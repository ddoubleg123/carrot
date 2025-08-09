
import FirebaseClientInit from './components/FirebaseClientInit';
import '../../../lib/firebase';
import { auth } from '../../../auth';
import { Suspense } from 'react';
import type { CommitmentCardProps } from './components/CommitmentCard';
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
    
    // Transform database posts to CommitmentCardProps format
    return posts.map((post: any) => ({
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '', // Remove name display per user request
        username: post.user?.username || 'daniel', // Use actual handle
        avatar: post.user?.profilePhoto || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/users%2Fcmdm0m8pl00004sbcjr0i6vjg%2Fstaged%2Fe137a64b-9b76-4127-a4c0-5fb2cd4c3176%2F9e257b08-4682-4ab1-839a-5ab2298e3084.png?alt=media&token=a06d95fc-1656-42af-a36f-b9a3349d4239',
        flag: '🇺🇸',
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
      gifUrl: post.gifUrl || null,
      thumbnailUrl: post.thumbnailUrl || null,
      audioUrl: post.audioUrl || null,
      emoji: post.emoji || '🎯',
      gradientFromColor: post.gradientFromColor || '#e0eafe',
      gradientToColor: post.gradientToColor || '#d1f7e6',
      gradientViaColor: post.gradientViaColor || '#f6e6fa',
      gradientDirection: post.gradientDirection || 'to-br',
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export default async function DashboardPage() {
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
      <div className="min-h-screen bg-white" style={{ marginTop: -20, paddingTop: 0 }}>

        <FirebaseClientInit />
        <FirebaseClientInit />
        <DashboardClientWrapper initialCommitments={commitments} />
      </div>
    </Suspense>
  );
}
