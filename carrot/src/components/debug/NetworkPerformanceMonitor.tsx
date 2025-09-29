'use client';

import React, { useState, useEffect } from 'react';

interface NetworkMetrics {
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  bytesDownloaded: number;
  speed: number; // bytes per second
  status: 'pending' | 'downloading' | 'complete' | 'error';
  error?: string;
}

export default function NetworkPerformanceMonitor() {
  const [metrics, setMetrics] = useState<NetworkMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Enable monitoring if debug flag is set
    const shouldMonitor = localStorage.getItem('NETWORK_MONITOR') === '1' || 
                         window.location.search.includes('debug=network');
    setIsVisible(shouldMonitor);

    if (!shouldMonitor) return;

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Only monitor video-related requests
      if (!url.includes('/api/video') && !url.includes('firebasestorage') && !url.includes('.mp4')) {
        return originalFetch(input, init);
      }

      const startTime = Date.now();
      const metric: NetworkMetrics = {
        url: url.slice(0, 100), // Truncate for display
        startTime,
        bytesDownloaded: 0,
        speed: 0,
        status: 'pending'
      };

      setMetrics(prev => [...prev, metric]);

      try {
        const response = await originalFetch(input, init);
        
        if (!response.body) {
          setMetrics(prev => prev.map(m => 
            m.url === metric.url && m.startTime === startTime 
              ? { ...m, status: 'error', error: 'No response body' }
              : m
          ));
          return response;
        }

        // Track download progress
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        setMetrics(prev => prev.map(m => 
          m.url === metric.url && m.startTime === startTime 
            ? { ...m, status: 'downloading' }
            : m
        ));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          totalBytes += value.length;
          
          const currentTime = Date.now();
          const duration = currentTime - startTime;
          const speed = duration > 0 ? (totalBytes / duration) * 1000 : 0; // bytes per second
          
          setMetrics(prev => prev.map(m => 
            m.url === metric.url && m.startTime === startTime 
              ? { 
                  ...m, 
                  bytesDownloaded: totalBytes,
                  speed,
                  duration
                }
              : m
          ));
        }

        // Mark as complete
        const endTime = Date.now();
        const finalDuration = endTime - startTime;
        const finalSpeed = finalDuration > 0 ? (totalBytes / finalDuration) * 1000 : 0;

        setMetrics(prev => prev.map(m => 
          m.url === metric.url && m.startTime === startTime 
            ? { 
                ...m, 
                status: 'complete',
                endTime,
                duration: finalDuration,
                speed: finalSpeed
              }
            : m
        ));

        // Reconstruct response
        const newResponse = new Response(
          new ReadableStream({
            start(controller) {
              chunks.forEach(chunk => controller.enqueue(chunk));
              controller.close();
            }
          }),
          {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          }
        );

        return newResponse;

      } catch (error) {
        setMetrics(prev => prev.map(m => 
          m.url === metric.url && m.startTime === startTime 
            ? { 
                ...m, 
                status: 'error', 
                error: error instanceof Error ? error.message : String(error),
                endTime: Date.now(),
                duration: Date.now() - startTime
              }
            : m
        ));
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!isVisible) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-lg max-h-96 overflow-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">Network Performance Monitor</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="text-xs space-y-2">
        {metrics.length === 0 ? (
          <div className="text-gray-400">No video requests detected yet...</div>
        ) : (
          metrics.slice(-10).reverse().map((metric, i) => (
            <div key={i} className="border-b border-gray-700 pb-2">
              <div className="flex justify-between items-start mb-1">
                <span className={`font-mono text-xs ${
                  metric.status === 'complete' ? 'text-green-400' :
                  metric.status === 'error' ? 'text-red-400' :
                  metric.status === 'downloading' ? 'text-yellow-400' :
                  'text-gray-400'
                }`}>
                  {metric.status.toUpperCase()}
                </span>
                <span className="text-gray-400">
                  {metric.duration ? `${metric.duration}ms` : '...'}
                </span>
              </div>
              
              <div className="text-gray-300 break-all mb-1">
                {metric.url}
              </div>
              
              <div className="flex justify-between text-gray-400">
                <span>{formatBytes(metric.bytesDownloaded)}</span>
                <span>{formatSpeed(metric.speed)}</span>
              </div>
              
              {metric.error && (
                <div className="text-red-400 text-xs mt-1">
                  Error: {metric.error}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        Enable: localStorage.setItem('NETWORK_MONITOR', '1')
      </div>
    </div>
  );
}
