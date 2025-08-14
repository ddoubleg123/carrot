'use client';

import React, { useState, useEffect } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  postId?: string;
  initialTranscription?: string | null;
  transcriptionStatus?: string | null;
  uploadStatus?: 'uploading' | 'uploaded' | 'processing' | 'ready' | null;
  uploadProgress?: number;
}

export default function VideoPlayer({ videoUrl, thumbnailUrl, postId, initialTranscription, transcriptionStatus, uploadStatus, uploadProgress }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ isChromium: boolean; supportsH264: boolean } | null>(null);
  
  // Transcription state
  const [realTranscriptionStatus, setRealTranscriptionStatus] = useState<string | null>(transcriptionStatus || null);
  const [realTranscriptionText, setRealTranscriptionText] = useState<string | null>(initialTranscription || null);
  
  // Upload and video state
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showThumbnailOverlay, setShowThumbnailOverlay] = useState(uploadStatus === 'uploading' || uploadStatus === 'uploaded');

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

  // Poll for transcription status if postId is provided
  useEffect(() => {
    if (!postId) {
      return; // Skip polling if no postId
    }
    
    // For temp IDs, show pending status immediately
    if (postId.startsWith('temp-')) {
      setRealTranscriptionStatus('pending');
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;

    const pollTranscriptionStatus = async () => {
      try {
        const response = await fetch(`/api/transcribe?postId=${postId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setRealTranscriptionStatus(data.status);
          if (data.transcription) {
            setRealTranscriptionText(data.transcription);
          }
          
          // Stop polling if transcription is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    };

    // Start polling if transcription is pending or processing
    if (realTranscriptionStatus === 'pending' || realTranscriptionStatus === 'processing') {
      pollTranscriptionStatus(); // Initial check
      pollInterval = setInterval(pollTranscriptionStatus, 3000); // Poll every 3 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [postId, realTranscriptionStatus]);

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
    <div className="w-full">
      <div className="relative">
        <video
          controls={uploadStatus === 'ready' || videoLoaded}
          muted
          autoPlay={uploadStatus === 'ready' && videoLoaded}
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
            objectFit: 'contain',
            opacity: showThumbnailOverlay ? 0.7 : 1
          }}
          onError={handleError}
          onLoadedData={() => {
            setVideoLoaded(true);
            if (uploadStatus === 'ready') {
              setShowThumbnailOverlay(false);
            }
          }}
        />
        
        {/* Upload Progress Overlay */}
        {showThumbnailOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <div className="text-center text-white">
              {uploadStatus === 'uploading' && (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm font-medium">Uploading video...</p>
                  {uploadProgress && (
                    <div className="mt-2 w-32 bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </>
              )}
              {uploadStatus === 'uploaded' && (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm font-medium">Processing video...</p>
                </>
              )}
              {uploadStatus === 'processing' && (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm font-medium">Preparing video...</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Video Transcription Section */}
      {postId && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4zM6 6v12h12V6H6z" />
            </svg>
            <h4 className="text-sm font-medium text-gray-700">Video Transcription</h4>
          </div>
          
          {(realTranscriptionStatus === 'pending' || (!realTranscriptionStatus && postId)) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
              <span>
                {uploadStatus === 'uploading' || uploadStatus === 'uploaded' || uploadStatus === 'processing' 
                  ? 'Preparing video transcription...' 
                  : 'Processing video transcription...'
                }
              </span>
            </div>
          )}
          
          {realTranscriptionStatus === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
              <span>AI is transcribing your video...</span>
            </div>
          )}
          
          {realTranscriptionText && realTranscriptionStatus === 'completed' && (
            <div className="text-sm text-gray-800 leading-relaxed">
              <p>{realTranscriptionText}</p>
            </div>
          )}
          
          {realTranscriptionStatus === 'failed' && (
            <div className="text-sm text-red-600">
              <p>Transcription failed. Please try uploading again.</p>
              {realTranscriptionText && (
                <p className="text-xs mt-1 text-gray-500">Error: {realTranscriptionText}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
