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

  // Safely attempt play, skipping when no source is available
  const safePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    // 3 = NETWORK_NO_SOURCE
    if (el.networkState === 3) return;
    // Skip if no selected source yet
    if (!el.currentSrc) return;
    // Wait until metadata is available (HAVE_METADATA = 1) or better
    if (el.readyState < 1) return;
    // Ensure muted for autoplay policy
    el.muted = true;
    el.play().catch(() => {});
  };

  // Derive a best-guess MIME type from the URL/extension to help browsers choose the decoder
  const getMimeType = (url: string): string | undefined => {
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return undefined; // Let the browser infer if unknown
  };

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

    // Find nearest scrollable ancestor to observe within scroll containers
    const findScrollParent = (el: HTMLElement | null): Element | null => {
      let node: HTMLElement | null = el;
      while (node && node.parentElement) {
        const style = window.getComputedStyle(node.parentElement);
        const overflowY = style.getPropertyValue('overflow-y');
        const overflow = style.getPropertyValue('overflow');
        if (/(auto|scroll)/.test(overflowY) || /(auto|scroll)/.test(overflow)) {
          return node.parentElement;
        }
        node = node.parentElement;
      }
      return null;
    };

    const rootEl = findScrollParent(videoRef.current) as Element | null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
          
          if (entry.isIntersecting && videoRef.current) {
            // Auto-play when video comes into view (muted)
            safePlay();
            setIsPlaying(true);
          } else if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            // Pause when video goes out of view
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: 0.15, // Trigger when 15% of video is visible
        rootMargin: '0px',
        root: rootEl || null
      }
    );

    observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, []);

  // Ensure autoplay when in view and video is ready; pause when out of view
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isInView) {
      safePlay();
      setIsPlaying(true);
      // Fallback: retry play shortly after visibility in case metadata just arrived
      const t = setTimeout(() => {
        safePlay();
      }, 300);
      return () => clearTimeout(t);
    } else {
      if (!el.paused) {
        el.pause();
        setIsPlaying(false);
      }
    }
  }, [isInView]);

  // On mount, if the element is already visible, attempt to play
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Ensure muted is set ASAP to satisfy autoplay policies
    el.muted = true;
    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
    if (inViewport) {
      safePlay();
    }
  }, []);

  // Reload the media element when the source URL changes to avoid stale networkState
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    setHasError(false);
    setVideoLoaded(false);
    try {
      // Ensure muted stays true across source swaps for autoplay compliance
      el.muted = true;
      el.load();
    } catch {}
  }, [videoUrl]);

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
          key={videoUrl}
          ref={videoRef}
          controls
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          crossOrigin="anonymous"
          poster={thumbnailUrl || undefined}
          src={videoUrl}
          style={{ 
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            maxHeight: 'min(70vh, 600px)',
            borderRadius: '8px',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            margin: '0 auto',
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
          onLoadedMetadata={() => {
            // Attempt to begin playback as soon as metadata is available and element is in view
            if (videoRef.current && isInView) {
              safePlay();
            }
          }}
          onCanPlay={() => {
            if (videoRef.current && isInView) {
              safePlay();
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          {/* Provide explicit source with MIME type hint to improve decoding compatibility */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {/* Omit explicit type so the browser can infer; Firebase URLs may carry codecs */}
          <source src={videoUrl} />
        </video>
        
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
