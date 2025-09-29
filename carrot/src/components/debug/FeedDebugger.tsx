'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PostData {
  id: string;
  content: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  author: {
    username: string;
  };
  createdAt: string;
}

interface MediaTask {
  id: string;
  postId: string;
  type: string;
  priority: number;
  feedIndex: number;
  url: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  error?: string;
}

export default function FeedDebugger() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [mediaTasks, setMediaTasks] = useState<MediaTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/posts');
      const data = await response.json();
      setPosts(data);
      console.log('[FeedDebugger] Posts fetched:', data.length);
    } catch (error) {
      console.error('[FeedDebugger] Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMediaPreloadQueue = () => {
    // Access the MediaPreloadQueue instance if available
    if (typeof window !== 'undefined' && (window as any).MediaPreloadQueue) {
      const queue = (window as any).MediaPreloadQueue.instance;
      const tasks = Array.from(queue.tasks?.values() || []);
      const activeTasks = new Map();
      
      // Get active tasks
      for (const [type, taskSet] of queue.activeTasks?.entries() || []) {
        activeTasks.set(type, Array.from(taskSet));
      }
      
      // Get sequential stats
      const sequentialStats = queue.getSequentialStats?.() || {};
      
      setDebugInfo({
        totalTasks: tasks.length,
        activeTasks: Object.fromEntries(activeTasks),
        completedTasks: queue.completedTasks?.size || 0,
        globalBudgetUsed: queue.globalBudgetUsed || 0,
        isProcessing: queue.isProcessing || false,
        sequentialStats
      });
    }
  };

  const checkVideoUrls = () => {
    const videoPosts = posts.filter(post => post.videoUrl);
    const urlIssues = videoPosts.map(post => {
      const url = post.videoUrl!;
      const isDoubleEncoded = /%25[0-9A-Fa-f]{2}/.test(url);
      const isProxyUrl = url.includes('/api/video');
      
      return {
        postId: post.id,
        url,
        isDoubleEncoded,
        isProxyUrl,
        issues: [
          isDoubleEncoded ? 'Double-encoded URL' : null,
          !isProxyUrl ? 'Not using proxy' : null
        ].filter(Boolean)
      };
    });
    
    setDebugInfo((prev: any) => ({ ...prev, urlIssues }));
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (posts.length > 0) {
      checkVideoUrls();
    }
  }, [posts]);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Feed Debugger
            <Badge variant="outline">{posts.length} posts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchPosts} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh Posts'}
            </Button>
            <Button onClick={checkMediaPreloadQueue} variant="outline">
              Check Media Queue
            </Button>
          </div>

          {/* Posts Summary */}
          <div>
            <h3 className="font-semibold mb-2">Posts Summary</h3>
            <div className="text-sm space-y-1">
              <div>Total posts: {posts.length}</div>
              <div>Video posts: {posts.filter(p => p.videoUrl).length}</div>
              <div>Image posts: {posts.filter(p => p.thumbnailUrl && !p.videoUrl).length}</div>
              <div>Text posts: {posts.filter(p => !p.videoUrl && !p.thumbnailUrl).length}</div>
            </div>
          </div>

          {/* URL Issues */}
          {debugInfo.urlIssues && (
            <div>
              <h3 className="font-semibold mb-2">URL Issues</h3>
              <div className="space-y-2">
                {debugInfo.urlIssues.map((issue: any) => (
                  <div key={issue.postId} className="p-2 border rounded text-sm">
                    <div className="font-medium">Post {issue.postId}</div>
                    <div className="text-gray-600 truncate">{issue.url}</div>
                    {issue.issues.length > 0 && (
                      <div className="text-red-600">
                        Issues: {issue.issues.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media Queue Info */}
          {debugInfo.totalTasks !== undefined && (
            <div>
              <h3 className="font-semibold mb-2">Media Preload Queue</h3>
              <div className="text-sm space-y-1">
                <div>Total tasks: {debugInfo.totalTasks}</div>
                <div>Completed tasks: {debugInfo.completedTasks}</div>
                <div>Budget used: {Math.round(debugInfo.globalBudgetUsed / 1024 / 1024 * 10) / 10} MB</div>
                <div>Processing: {debugInfo.isProcessing ? 'Yes' : 'No'}</div>
                {debugInfo.sequentialStats && (
                  <div>
                    <div>Last completed poster: {debugInfo.sequentialStats.lastCompletedPosterIndex}</div>
                    <div>Last completed video: {debugInfo.sequentialStats.lastCompletedVideoIndex}</div>
                    <div>Video progression: {debugInfo.sequentialStats.videoBlocksProgression ? 'Sequential' : 'Parallel'}</div>
                  </div>
                )}
                {debugInfo.activeTasks && Object.keys(debugInfo.activeTasks).length > 0 && (
                  <div>
                    Active tasks:
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1">
                      {JSON.stringify(debugInfo.activeTasks, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Posts List */}
          <div>
            <h3 className="font-semibold mb-2">Posts Details</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {posts.map((post) => (
                <div key={post.id} className="p-2 border rounded text-sm">
                  <div className="font-medium">@{post.author?.username || 'user'}</div>
                  <div className="text-gray-600 truncate">{post.content}</div>
                  <div className="text-xs text-gray-500">
                    {post.videoUrl && '📹 Video'}
                    {post.thumbnailUrl && !post.videoUrl && '🖼️ Image'}
                    {!post.videoUrl && !post.thumbnailUrl && '📝 Text'}
                    {' • '}
                    {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
