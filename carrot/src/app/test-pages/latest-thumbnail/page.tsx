'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ThumbnailData {
  id: string;
  postId: string;
  userId: string;
  thumbnailUrl: string;
  videoUrl: string;
  content: string;
  createdAt: string;
  author: {
    name: string;
    username: string;
  };
}

export default function LatestThumbnailTest() {
  const [thumbnailData, setThumbnailData] = useState<ThumbnailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestThumbnail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test/latest-thumbnail');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setThumbnailData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch thumbnail');
      console.error('Error fetching latest thumbnail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestThumbnail();
  }, []);

  const handleRefresh = () => {
    fetchLatestThumbnail();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Latest Thumbnail Test</h1>
            <Button onClick={handleRefresh} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>


          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading latest thumbnail...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-red-800 font-semibold mb-2">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {thumbnailData && (
            <div className="space-y-6">
              {/* Thumbnail Display */}
              <div className="bg-gray-100 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Latest Thumbnail</h2>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    {thumbnailData.thumbnailUrl ? (
                      <img
                        src={thumbnailData.thumbnailUrl}
                        alt="Latest thumbnail"
                        className="w-64 h-36 object-cover rounded-lg border border-gray-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/api/img?generatePoster=1&videoUrl=' + encodeURIComponent(thumbnailData.videoUrl);
                        }}
                      />
                    ) : (
                      <div className="w-64 h-36 bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center">
                        <span className="text-gray-500">No thumbnail</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Post Details</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Post ID:</span> {thumbnailData.postId}</p>
                      <p><span className="font-medium">Author:</span> {thumbnailData.author.name} (@{thumbnailData.author.username})</p>
                      <p><span className="font-medium">Created:</span> {new Date(thumbnailData.createdAt).toLocaleString()}</p>
                      <p><span className="font-medium">Content:</span> {thumbnailData.content || 'No content'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-blue-800 font-semibold mb-2">URL Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Thumbnail URL:</span>
                    <div className="mt-1 p-2 bg-white rounded border text-xs break-all">
                      {thumbnailData.thumbnailUrl || 'No thumbnail URL'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Video URL:</span>
                    <div className="mt-1 p-2 bg-white rounded border text-xs break-all">
                      {thumbnailData.videoUrl || 'No video URL'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Firebase Storage Analysis */}
              {thumbnailData.thumbnailUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-green-800 font-semibold mb-2">Firebase Storage Analysis</h3>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      try {
                        const url = new URL(thumbnailData.thumbnailUrl);
                        const isFirebase = url.hostname.includes('firebasestorage');
                        const pathMatch = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
                        
                        return (
                          <>
                            <p><span className="font-medium text-green-700">Is Firebase Storage:</span> {isFirebase ? 'Yes' : 'No'}</p>
                            {isFirebase && pathMatch && (
                              <>
                                <p><span className="font-medium text-green-700">Bucket:</span> {pathMatch[1]}</p>
                                <p><span className="font-medium text-green-700">Path:</span> {decodeURIComponent(pathMatch[2])}</p>
                              </>
                            )}
                            <p><span className="font-medium text-green-700">Hostname:</span> {url.hostname}</p>
                          </>
                        );
                      } catch {
                        return <p className="text-red-600">Invalid URL format</p>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Test Actions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-yellow-800 font-semibold mb-2">Test Actions</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (thumbnailData.thumbnailUrl) {
                        window.open(thumbnailData.thumbnailUrl, '_blank');
                      }
                    }}
                    disabled={!thumbnailData.thumbnailUrl}
                  >
                    Open Thumbnail in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (thumbnailData.videoUrl) {
                        window.open(thumbnailData.videoUrl, '_blank');
                      }
                    }}
                    disabled={!thumbnailData.videoUrl}
                  >
                    Open Video in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (thumbnailData.thumbnailUrl) {
                        const fallbackUrl = '/api/img?generatePoster=1&videoUrl=' + encodeURIComponent(thumbnailData.videoUrl);
                        window.open(fallbackUrl, '_blank');
                      }
                    }}
                    disabled={!thumbnailData.videoUrl}
                  >
                    Test Fallback Thumbnail
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !thumbnailData && (
            <div className="text-center py-8">
              <p className="text-gray-600">No thumbnails found in the database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
