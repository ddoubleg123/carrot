"use client";

import React, { useState, useEffect } from 'react';
import MediaMetrics from '../../lib/MediaMetrics';
import MediaPreloadQueue from '../../lib/MediaPreloadQueue';
import MediaStateCache from '../../lib/MediaStateCache';

interface DashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

const MediaDebugDashboard: React.FC<DashboardProps> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState(MediaMetrics.instance.getSummary());
  const [queueStats, setQueueStats] = useState(MediaPreloadQueue.getStats());
  const [cacheStats, setCacheStats] = useState(MediaStateCache.instance.getStats());
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2 seconds

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setMetrics(MediaMetrics.instance.getSummary());
      setQueueStats(MediaPreloadQueue.getStats());
      setCacheStats(MediaStateCache.instance.getStats());
      
      // Run alert checks
      MediaMetrics.instance.checkAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isVisible, refreshInterval]);

  if (!isVisible) return null;

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'text-green-400' : 'text-red-400';
  };

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
  const formatMs = (value: number) => `${value}ms`;
  const formatMB = (value: number) => `${value}MB`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Media Debug Dashboard</h2>
          <div className="flex items-center gap-4">
            <select 
              value={refreshInterval} 
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-gray-800 text-white px-3 py-1 rounded"
            >
              <option value={1000}>1s refresh</option>
              <option value={2000}>2s refresh</option>
              <option value={5000}>5s refresh</option>
            </select>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Poster Performance */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-blue-400">📸 Poster Performance</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Loads:</span>
                <span className="font-mono">{metrics.posterStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Within 200ms:</span>
                <span className={`font-mono ${getStatusColor(metrics.posterStats.within200ms / Math.max(1, metrics.posterStats.total), 0.8)}`}>
                  {metrics.posterStats.within200ms}/{metrics.posterStats.total} ({formatPercent(metrics.posterStats.within200ms / Math.max(1, metrics.posterStats.total))})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Load Time:</span>
                <span className={`font-mono ${getStatusColor(metrics.posterStats.averageLoadTime, 200, true)}`}>
                  {formatMs(metrics.posterStats.averageLoadTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className={`font-mono ${getStatusColor(metrics.posterStats.successRate, 0.95)}`}>
                  {formatPercent(metrics.posterStats.successRate)}
                </span>
              </div>
            </div>
          </div>

          {/* TTFF Performance */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-green-400">⚡ Time To First Frame</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Videos:</span>
                <span className="font-mono">{metrics.ttffStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>P50 TTFF:</span>
                <span className={`font-mono ${getStatusColor(metrics.ttffStats.p50, 500, true)}`}>
                  {formatMs(metrics.ttffStats.p50)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>P75 TTFF:</span>
                <span className={`font-mono ${getStatusColor(metrics.ttffStats.p75, 800, true)}`}>
                  {formatMs(metrics.ttffStats.p75)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>P95 TTFF:</span>
                <span className={`font-mono ${getStatusColor(metrics.ttffStats.p95, 1500, true)}`}>
                  {formatMs(metrics.ttffStats.p95)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average:</span>
                <span className="font-mono text-gray-300">{formatMs(metrics.ttffStats.averageTTFF)}</span>
              </div>
            </div>
          </div>

          {/* Cache Performance */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-purple-400">💾 Cache Performance</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Poster Hit Rate:</span>
                <span className={`font-mono ${getStatusColor(metrics.cacheStats.posterHitRate, 0.7)}`}>
                  {formatPercent(metrics.cacheStats.posterHitRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Video Hit Rate:</span>
                <span className={`font-mono ${getStatusColor(metrics.cacheStats.videoHitRate, 0.5)}`}>
                  {formatPercent(metrics.cacheStats.videoHitRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Hits:</span>
                <span className="font-mono text-gray-300">{metrics.cacheStats.totalHits}/{metrics.cacheStats.totalRequests}</span>
              </div>
              <div className="flex justify-between">
                <span>Overall Hit Rate:</span>
                <span className={`font-mono ${getStatusColor(metrics.cacheStats.totalHits / Math.max(1, metrics.cacheStats.totalRequests), 0.6)}`}>
                  {formatPercent(metrics.cacheStats.totalHits / Math.max(1, metrics.cacheStats.totalRequests))}
                </span>
              </div>
            </div>
          </div>

          {/* Error Tracking */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-red-400">🚨 Error Tracking</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>ExpiredToken Errors:</span>
                <span className={`font-mono ${metrics.errorStats.expiredTokenCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {metrics.errorStats.expiredTokenCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Errors:</span>
                <span className="font-mono text-gray-300">{metrics.errorStats.totalErrors}</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate:</span>
                <span className={`font-mono ${getStatusColor(metrics.errorStats.errorRate, 0.05, true)}`}>
                  {formatPercent(metrics.errorStats.errorRate)}
                </span>
              </div>
              <div className="mt-3 p-2 bg-gray-700 rounded text-xs">
                {metrics.errorStats.expiredTokenCount === 0 ? (
                  <span className="text-green-400">✅ No ExpiredToken errors</span>
                ) : (
                  <span className="text-red-400">❌ ExpiredToken errors detected!</span>
                )}
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-yellow-400">🧠 Memory Usage</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Current Usage:</span>
                <span className={`font-mono ${getStatusColor(metrics.memoryStats.currentUsageMB, 200, true)}`}>
                  {formatMB(metrics.memoryStats.currentUsageMB)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average Usage:</span>
                <span className="font-mono text-gray-300">{formatMB(metrics.memoryStats.averageUsageMB)}</span>
              </div>
              <div className="flex justify-between">
                <span>Peak Usage:</span>
                <span className={`font-mono ${getStatusColor(metrics.memoryStats.peakUsageMB, 250, true)}`}>
                  {formatMB(metrics.memoryStats.peakUsageMB)}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                State Cache: {formatMB(cacheStats.totalSizeMB)} / {formatMB(cacheStats.maxSizeMB)}
              </div>
            </div>
          </div>

          {/* Preload Queue Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-cyan-400">⏳ Preload Queue</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Processing:</span>
                <span className={`font-mono ${queueStats.isProcessing ? 'text-green-400' : 'text-gray-400'}`}>
                  {queueStats.isProcessing ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Budget Used:</span>
                <span className={`font-mono ${getStatusColor(queueStats.globalBudgetUsed / 1024 / 1024, queueStats.globalBudgetMB * 0.8, true)}`}>
                  {formatMB(Math.round(queueStats.globalBudgetUsed / 1024 / 1024 * 100) / 100)} / {formatMB(queueStats.globalBudgetMB)}
                </span>
              </div>
              
              {/* Task breakdown */}
              <div className="mt-3 space-y-1">
                {Object.entries(queueStats.byType).map(([type, stats]) => (
                  <div key={type} className="flex justify-between text-xs">
                    <span className="text-gray-400">{type}:</span>
                    <span className="font-mono">
                      Q:{stats.queued} A:{stats.active} C:{stats.completed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* State Cache Details */}
          <div className="bg-gray-800 rounded-lg p-4 lg:col-span-2 xl:col-span-1">
            <h3 className="text-lg font-semibold mb-3 text-indigo-400">💽 State Cache</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Entries:</span>
                <span className="font-mono">{cacheStats.totalEntries}</span>
              </div>
              <div className="flex justify-between">
                <span>Hit Rate:</span>
                <span className={`font-mono ${getStatusColor(cacheStats.hitRate, 0.7)}`}>
                  {formatPercent(cacheStats.hitRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Evictions:</span>
                <span className="font-mono text-gray-300">{cacheStats.evictions}</span>
              </div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className={`font-mono ${getStatusColor(cacheStats.totalSizeMB, cacheStats.maxSizeMB * 0.8, true)}`}>
                  {formatMB(cacheStats.totalSizeMB)} / {formatMB(cacheStats.maxSizeMB)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-800 rounded-lg p-4 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-3 text-orange-400">🔧 Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => MediaMetrics.instance.cleanup()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Clean Metrics
              </button>
              <button 
                onClick={() => MediaStateCache.instance.cleanup()}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Clean Cache
              </button>
              <button 
                onClick={() => {
                  const data = MediaMetrics.instance.exportMetrics();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `media-metrics-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
              >
                Export Data
              </button>
              <button 
                onClick={() => {
                  MediaStateCache.instance.clear();
                  console.log('State cache cleared');
                }}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Clear All Cache
              </button>
            </div>
            
            <div className="mt-3 text-xs text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Keyboard shortcut to toggle dashboard
export const useMediaDebugDashboard = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+M to toggle dashboard
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return {
    isVisible,
    setIsVisible,
    toggle: () => setIsVisible(prev => !prev)
  };
};

export default MediaDebugDashboard;
