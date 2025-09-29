'use client';

import React, { useState, useEffect, useRef } from 'react';

interface VideoLoadingDiagnosticsProps {
  videoUrl: string;
  postId: string;
  onDiagnosticsComplete?: (results: any) => void;
}

interface DiagnosticResult {
  timestamp: number;
  event: string;
  details: any;
  duration?: number;
}

export default function VideoLoadingDiagnostics({ 
  videoUrl, 
  postId, 
  onDiagnosticsComplete 
}: VideoLoadingDiagnosticsProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTime = useRef<number>(Date.now());

  const addDiagnostic = (event: string, details: any = {}) => {
    const now = Date.now();
    const duration = now - startTime.current;
    const diagnostic: DiagnosticResult = {
      timestamp: now,
      event,
      details,
      duration
    };
    
    setDiagnostics(prev => [...prev, diagnostic]);
    console.log(`[VideoDiagnostics] ${event}`, { postId, duration, ...details });
  };

  const testVideoLoading = async () => {
    if (!videoUrl) return;
    
    addDiagnostic('DIAGNOSTIC_START', { videoUrl, postId });
    
    // Test 1: Basic fetch to check if URL is accessible
    try {
      addDiagnostic('FETCH_TEST_START');
      const response = await fetch(videoUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      addDiagnostic('FETCH_TEST_COMPLETE', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (error) {
      addDiagnostic('FETCH_TEST_ERROR', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 2: Range request test (first 1MB)
    try {
      addDiagnostic('RANGE_TEST_START');
      const response = await fetch(videoUrl, {
        method: 'GET',
        headers: { 'Range': 'bytes=0-1048576' },
        signal: AbortSignal.timeout(10000)
      });
      addDiagnostic('RANGE_TEST_COMPLETE', {
        status: response.status,
        contentLength: response.headers.get('content-length'),
        contentRange: response.headers.get('content-range'),
        acceptRanges: response.headers.get('accept-ranges')
      });
    } catch (error) {
      addDiagnostic('RANGE_TEST_ERROR', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 3: Video element loading test
    if (videoRef.current) {
      const video = videoRef.current;
      
      const events = [
        'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
        'progress', 'suspend', 'abort', 'error', 'stalled', 'waiting'
      ];

      events.forEach(eventType => {
        video.addEventListener(eventType, (e) => {
          addDiagnostic(`VIDEO_${eventType.toUpperCase()}`, {
            readyState: video.readyState,
            networkState: video.networkState,
            currentTime: video.currentTime,
            duration: video.duration,
            buffered: video.buffered.length > 0 ? {
              start: video.buffered.start(0),
              end: video.buffered.end(0)
            } : null
          });
        });
      });

      // Start video loading
      addDiagnostic('VIDEO_LOAD_START');
      video.src = videoUrl;
      video.load();
    }
  };

  useEffect(() => {
    // Check if diagnostics should be enabled
    const shouldDiagnose = localStorage.getItem('VIDEO_DIAGNOSTICS') === '1' || 
                          window.location.search.includes('debug=video');
    setIsVisible(shouldDiagnose);
    
    if (shouldDiagnose) {
      testVideoLoading();
    }
  }, [videoUrl, postId]);

  useEffect(() => {
    if (diagnostics.length > 0 && onDiagnosticsComplete) {
      onDiagnosticsComplete(diagnostics);
    }
  }, [diagnostics, onDiagnosticsComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">Video Loading Diagnostics</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="text-xs space-y-1">
        <div className="text-gray-300">Post ID: {postId}</div>
        <div className="text-gray-300 break-all">URL: {videoUrl.slice(0, 50)}...</div>
        
        <div className="mt-2 space-y-1">
          {diagnostics.map((diag, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-green-400">{diag.event}</span>
              <span className="text-gray-400">{diag.duration}ms</span>
            </div>
          ))}
        </div>
      </div>
      
      <video 
        ref={videoRef}
        style={{ display: 'none' }}
        preload="metadata"
        muted
      />
    </div>
  );
}
