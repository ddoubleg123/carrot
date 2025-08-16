'use client';

import { useState, useEffect } from 'react';
import { useSession, SessionProvider } from 'next-auth/react';
import CommitmentComposer from '../../dashboard/components/CommitmentComposer';
import CommitmentCard from '../../dashboard/components/CommitmentCard';
import ModernHeader from '../../dashboard-test/components/ModernHeader';
import { Post } from '@/types/post';

function TestDashboardClientInner() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch posts on component mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/posts', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Fetched posts:', data.length);
          setPosts(data);
        } else {
          console.error('Failed to fetch posts:', response.status);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchPosts();
    }
  }, [session]);

  const handleNewPost = (newPost: Post) => {
    console.log('🆕 Adding new post to test dashboard:', newPost.id);
    setPosts(prevPosts => [newPost, ...prevPosts]);
  };

  const handleUpdateCommitment = (postId: string, updates: Partial<Post>) => {
    console.log('🔄 Updating post in test dashboard:', postId, updates);
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, ...updates }
          : post
      )
    );
  };

  const handleDeletePost = (postId: string) => {
    console.log('🗑️ Deleting post from test dashboard:', postId);
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  const handleBlockPost = (postId: string) => {
    console.log('🚫 Blocking post in test dashboard:', postId);
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  if (!session?.user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Test Dashboard Header */}
      <ModernHeader />
      
      {/* Test Banner */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 text-center font-semibold">
        🧪 TEST DASHBOARD - Safe Testing Environment
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 pt-10">
        <div className="flex gap-8">
          {/* Main Feed */}
          <div className="flex-1 max-w-[650px]">
            {/* Composer */}
            <div className="mb-8">
              <CommitmentComposer 
                onPost={handleNewPost}
                onPostUpdate={handleUpdateCommitment}
              />
            </div>

            {/* Posts Feed */}
            <div className="space-y-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🥕</div>
                  <div className="text-gray-600">Loading posts...</div>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🐰</div>
                  <div className="text-xl text-gray-600 mb-2">No posts yet!</div>
                  <div className="text-gray-500">Create your first post above to get started.</div>
                </div>
              ) : (
                posts.map((post) => (
                  <CommitmentCard
                    key={post.id}
                    post={post}
                    currentUser={session.user}
                    onUpdate={handleUpdateCommitment}
                    onDelete={handleDeletePost}
                    onBlock={handleBlockPost}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Rail - Test Info */}
          <div className="w-80 hidden lg:block">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                🧪 Test Environment
              </h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-semibold text-purple-800 mb-1">Safe Testing</div>
                  <div>This is a duplicate of the main dashboard for safe experimentation.</div>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-green-800 mb-1">Protected Features</div>
                  <div>🥕 Video upload animations<br/>🐰 Cute progress messages<br/>✨ Status update fixes</div>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-blue-800 mb-1">Same Database</div>
                  <div>Posts created here will appear on the main dashboard too.</div>
                </div>
                
                <div className="text-center pt-4">
                  <a 
                    href="/dashboard" 
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    ← Back to Main Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestDashboardClient() {
  return (
    <SessionProvider>
      <TestDashboardClientInner />
    </SessionProvider>
  );
}
