'use client';

import React from 'react';
import SimpleVideo from '@/components/SimpleVideo';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  postId: string;
  initialTranscription?: string;
  transcriptionStatus?: string;
  uploadStatus?: string | null;
  uploadProgress?: number;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  disableNativeControls?: boolean;
}

export default function VideoPlayer({ 
  videoUrl, 
  thumbnailUrl, 
  postId, 
  initialTranscription, 
  transcriptionStatus, 
  uploadStatus, 
  uploadProgress, 
  onVideoRef, 
  disableNativeControls = true 
}: VideoPlayerProps) {
  
  // VALIDATION: Check for valid video URL before passing to SimpleVideo
  const VALID_VIDEO_FORMATS = /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)(\?|$)/i;
  const VALID_VIDEO_MIME_TYPES = /^(video\/|application\/x-mpegURL|application\/vnd\.apple\.mpegurl)/i;
  
  // Validate videoUrl
  if (!videoUrl) {
    console.warn('[VideoPlayer] Missing videoUrl', { postId });
    return (
      <div className="w-full flex items-center justify-center bg-gray-100 rounded-xl p-8">
        <p className="text-gray-500 text-sm">Video unavailable</p>
      </div>
    );
  }
  
  // Check if it's a valid format (allow proxied URLs, data URIs with video MIME, or direct URLs with extensions)
  const isProxied = videoUrl.startsWith('/api/video');
  const isDataUri = videoUrl.startsWith('data:');
  const hasValidExtension = VALID_VIDEO_FORMATS.test(videoUrl);
  const hasValidMimeType = isDataUri && VALID_VIDEO_MIME_TYPES.test(videoUrl);
  
  if (!isProxied && !hasValidExtension && !hasValidMimeType) {
    console.warn('[VideoPlayer] Invalid video format detected', { 
      postId, 
      videoUrl: videoUrl.substring(0, 100),
      isProxied,
      isDataUri,
      hasValidExtension,
      hasValidMimeType,
      hint: 'Expected: .mp4, .webm, .mov, etc., or proxied URL, or video data URI'
    });
    return (
      <div className="w-full flex items-center justify-center bg-gray-100 rounded-xl p-8">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-1">Invalid video format</p>
          <p className="text-gray-400 text-xs">Source: {videoUrl.substring(0, 50)}...</p>
        </div>
      </div>
    );
  }
  
  // Simple URL resolution - no complex logic
  const resolvedSrc = videoUrl;
  const resolvedPoster = thumbnailUrl;

  return (
    <div className="w-full">
      <div className="relative">
        <SimpleVideo
          src={resolvedSrc}
          poster={resolvedPoster}
          controls={!disableNativeControls}
          autoPlay={true}
          muted={true}
          playsInline={true}
          postId={postId}
          onVideoRef={onVideoRef}
          className="w-full rounded-xl"
        />
      </div>
    </div>
  );
}
