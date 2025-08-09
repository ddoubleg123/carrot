'use client';

import { useEffect, useState } from 'react';

interface BrowserInfo {
  isChromium: boolean;
  isChrome: boolean;
  supportsH264: boolean;
  browserName: string;
}

export default function BrowserCompatibilityCheck() {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectBrowser = (): BrowserInfo => {
      const userAgent = navigator.userAgent;
      const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
      const isChromium = /Chrome/.test(userAgent) && !isChrome;
      
      // Test H.264 support
      const video = document.createElement('video');
      const supportsH264 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
      
      let browserName = 'Unknown';
      if (isChrome) browserName = 'Google Chrome';
      else if (isChromium) browserName = 'Chromium';
      else if (/Firefox/.test(userAgent)) browserName = 'Firefox';
      else if (/Safari/.test(userAgent)) browserName = 'Safari';
      else if (/Edge/.test(userAgent)) browserName = 'Microsoft Edge';

      return {
        isChromium,
        isChrome,
        supportsH264,
        browserName
      };
    };

    const info = detectBrowser();
    setBrowserInfo(info);
    
    // Show warning if using Chromium without H.264 support
    if (info.isChromium && !info.supportsH264) {
      setShowWarning(true);
    }
  }, []);

  if (!browserInfo || !showWarning) return null;

  return (
    <div className="fixed top-4 right-4 max-w-md bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-50">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Video Playback Limited
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              You're using <strong>{browserInfo.browserName}</strong>, which may not support all video formats.
            </p>
            <p className="mt-2">
              <strong>For full video support:</strong>
            </p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Use <strong>Google Chrome</strong> (recommended)</li>
              <li>Or install H.264 codec pack for Chromium</li>
              <li>Or convert videos to WebM format</li>
            </ul>
          </div>
          <div className="mt-3">
            <button
              onClick={() => setShowWarning(false)}
              className="text-sm text-yellow-800 underline hover:text-yellow-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
