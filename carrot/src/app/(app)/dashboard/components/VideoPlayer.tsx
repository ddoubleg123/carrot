'use client';

import React, { useState, useEffect } from 'react';

export default function VideoPlayer({ videoUrl, thumbnailUrl }: { videoUrl: string; thumbnailUrl?: string | null }) {
  const [hasError, setHasError] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ isChromium: boolean; supportsH264: boolean } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect browser and codec support
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isChromium = /Chrome/.test(userAgent) && !isChrome;
    
    // Test H.264 support
    const video = document.createElement('video');
    const supportsH264 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    
    setBrowserInfo({ isChromium, supportsH264 });
  }, []);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.target as HTMLVideoElement;
    
    // Only handle real video errors that would affect playback
    if (!video || !video.error) {
      return; // No video element or no error object
    }
    
    const error = video.error;
    
    // Only handle critical video errors that prevent playback
    // Error codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
    if (!error.code || error.code <= 0) {
      return; // Ignore spurious errors
    }
    
    // Only set error state for real playback failures, don't log to console
    // This prevents spurious console errors while still handling real failures
    if (error.code >= 3) { // Only DECODE and SRC_NOT_SUPPORTED errors
      setHasError(true);
    }
    
    // Note: Console logging disabled to prevent spurious error messages
    // Real video errors will still trigger the error UI via setHasError(true)
  };

  if (hasError && browserInfo?.isChromium && !browserInfo?.supportsH264) {
    return (
      <div 
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
        style={{ 
          maxWidth: '550px', 
          minWidth: '320px',
          width: '100%'
        }}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Video Format Not Supported
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>This video requires codecs not available in Chromium.</p>
              <p className="mt-2">
                <strong>To watch this video:</strong>
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Use <strong>Google Chrome</strong> instead</li>
                <li>Or <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-900">download the video</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <video
      controls
      muted
      autoPlay
      loop
      playsInline
      poster={thumbnailUrl || undefined}
      src={videoUrl}
      style={{ 
        width: '100%', 
        maxWidth: '550px', 
        minWidth: '320px',
        height: 'auto',
        maxHeight: 'min(70vh, 600px)',
        borderRadius: '8px',
        objectFit: 'contain'
      }}
      onError={handleError}
      onLoadedData={() => {}}
    />
  );
}
