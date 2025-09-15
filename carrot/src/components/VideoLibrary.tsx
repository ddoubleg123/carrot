'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUserVideos, useVideoVariants, getVideoThumbnail, getPlatformDisplayName, formatDuration } from '@/lib/videoDeduplicationClient';
import { VideoIngestModal } from './VideoIngestModal';

const VideoVariantEditorDynamic = dynamic(() => import('./VideoVariantEditor').then(m => m.VideoVariantEditor), {
  ssr: false,
  loading: () => null,
});

export function VideoLibrary() {
  const { videos, isLoading, error, refreshVideos } = useUserVideos();
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [showVariantEditor, setShowVariantEditor] = useState(false);

  const handleVideoIngested = () => {
    refreshVideos();
  };

  const handleCreateVariant = (video: any) => {
    setSelectedVideo(video);
    setShowVariantEditor(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Error loading videos: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Video Library</h2>
        <button
          onClick={() => setShowIngestModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <span>+</span>
          <span>Add Video</span>
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No videos</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a video from a URL.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowIngestModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Add your first video
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onCreateVariant={() => handleCreateVariant(video)}
            />
          ))}
        </div>
      )}

      <VideoIngestModal
        isOpen={showIngestModal}
        onClose={() => setShowIngestModal(false)}
        onVideoIngested={handleVideoIngested}
      />

      {selectedVideo && (
        <VideoVariantEditorDynamic
          isOpen={showVariantEditor}
          onClose={() => {
            setShowVariantEditor(false);
            setSelectedVideo(null);
          }}
          userVideo={selectedVideo}
        />
      )}
    </div>
  );
}

interface VideoCardProps {
  video: any;
  onCreateVariant: () => void;
}

function VideoCard({ video, onCreateVariant }: VideoCardProps) {
  const { variants } = useVideoVariants(video.id);
  const thumbnailUrl = getVideoThumbnail(video.asset);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {thumbnailUrl && (
        <div className="aspect-video bg-gray-200">
          <img
            src={thumbnailUrl}
            alt={video.asset.title || 'Video thumbnail'}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {video.titleOverride || video.asset.title || 'Untitled Video'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {getPlatformDisplayName(video.asset.platform)}
              {video.asset.authorHandle && ` • ${video.asset.authorHandle}`}
            </p>
            {video.asset.durationSec && (
              <p className="text-xs text-gray-400 mt-1">
                {formatDuration(video.asset.durationSec)}
              </p>
            )}
          </div>
          
          <div className="flex-shrink-0 ml-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              video.asset.status === 'ready' 
                ? 'bg-green-100 text-green-800'
                : video.asset.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : video.asset.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {video.asset.status === 'ready' ? 'Ready' : 
               video.asset.status === 'pending' ? 'Processing' :
               video.asset.status === 'failed' ? 'Failed' : 'Unknown'}
            </span>
          </div>
        </div>

        {video.notes && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {video.notes}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {variants.length > 0 ? `${variants.length} variant${variants.length === 1 ? '' : 's'}` : 'No variants'}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={onCreateVariant}
              disabled={video.asset.status !== 'ready'}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            
            {video.asset.status === 'ready' && video.asset.storageUri && (
              <a
                href={video.asset.storageUri}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                View
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
