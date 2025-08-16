'use client';

import React, { useState, useEffect, useRef } from 'react';

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
  const [showThumbnailOverlay, setShowThumbnailOverlay] = useState(uploadStatus === 'uploading' || uploadStatus === 'uploaded' || uploadStatus === 'processing');
  
  // Autoplay state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // IntersectionObserver for autoplay on scroll
  useEffect(() => {
    if (!videoRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
          
          if (entry.isIntersecting && videoRef.current && videoLoaded) {
            // Auto-play when video comes into view (muted)
            videoRef.current.play().catch((error) => {
              // Ignore normal play interruption errors
              if (error.name !== 'AbortError') {
                console.warn('Autoplay failed:', error);
              }
            });
            setIsPlaying(true);
          } else if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            // Pause when video goes out of view
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of video is visible
        rootMargin: '0px 0px -10% 0px' // Start slightly before fully in view
      }
    );

    observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, [videoLoaded]);

  // Ensure autoplay when in view and video is ready; pause when out of view
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isInView && videoLoaded) {
      el.play().then(() => setIsPlaying(true)).catch(() => {
        // Ignore autoplay rejections (browser policies)
      });
    } else {
      if (!el.paused) {
        el.pause();
        setIsPlaying(false);
      }
    }
  }, [isInView, videoLoaded]);

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
          ref={videoRef}
          controls
          muted
          loop
          playsInline
          autoPlay
          poster={thumbnailUrl || undefined}
          src={videoUrl}
          style={{ 
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            maxHeight: 'min(70vh, 600px)',
            borderRadius: '8px',
            objectFit: 'contain',
            opacity: showThumbnailOverlay ? 0.7 : 1
          }}
          onError={handleError}
          onLoadedData={() => {
            setVideoLoaded(true);
            // Hide overlay when video is ready to play (upload complete)
            if (uploadStatus === 'ready' || !uploadStatus) {
              setShowThumbnailOverlay(false);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Upload Progress Overlay - Only show during actual upload, not after completion */}
        {showThumbnailOverlay && uploadStatus !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <div className="text-center text-white">
              {uploadStatus === 'uploading' && (
                <>
                  <div className="animate-bounce text-4xl mb-2">🥕</div>
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
                  <div className="animate-pulse text-4xl mb-2">🐰</div>
                  <p className="text-sm font-medium">Saving to database...</p>
                </>
              )}
              {uploadStatus === 'processing' && (
                <>
                  <div className="animate-spin text-4xl mb-2">🥕</div>
                  <p className="text-sm font-medium">Finalizing video...</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Inline transcription UI removed; handled by parent panel */}
    </div>
  );
}
