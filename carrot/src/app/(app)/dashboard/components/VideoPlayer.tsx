'use client';

import React from 'react';
import SimpleVideo from '../../SimpleVideo';

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
          className="w-full rounded-xl"
        />
      </div>
    </div>
  );
}
