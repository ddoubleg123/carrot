'use client';

import { useState, useEffect } from 'react';
import { Brain, Sparkles, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface DiscoveryItem {
  id: string;
  type: string;
  title: string;
  relevanceScore: number;
  status: string;
  createdAt: string;
}

interface DiscoveryStatus {
  isDiscoveryActive: boolean;
  isRecentlyCreated: boolean;
  totalDiscovered: number;
  latestContent: DiscoveryItem[];
  discoveryStats: Record<string, number>;
}

interface DiscoveryStatusProps {
  patchHandle: string;
}

export default function DiscoveryStatus({ patchHandle }: DiscoveryStatusProps) {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/discovery-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch discovery status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll for updates every 3 seconds if discovery is active
    let interval: NodeJS.Timeout;
    if (status?.isDiscoveryActive) {
      interval = setInterval(fetchStatus, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [patchHandle, status?.isDiscoveryActive]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-blue-700 font-medium">Checking discovery status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">Failed to load discovery status</span>
        </div>
      </div>
    );
  }

  if (!status || !status.isRecentlyCreated) {
    return null; // Don't show for old patches
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return '📄';
      case 'source': return '🔗';
      case 'discussion_topic': return '💬';
      case 'timeline_event': return '📅';
      default: return '📝';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'audited': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-900">AI Discovery</span>
        </div>
        {status.isDiscoveryActive && (
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
            <span className="text-sm text-blue-700 font-medium">Active</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Discovery Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-blue-700">Total discovered:</span>
            <span className="font-semibold text-blue-900">{status.totalDiscovered}</span>
          </div>
          {status.discoveryStats.approved && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-700">{status.discoveryStats.approved} approved</span>
            </div>
          )}
          {status.discoveryStats.pending && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-yellow-500" />
              <span className="text-yellow-700">{status.discoveryStats.pending} pending</span>
            </div>
          )}
        </div>

        {/* Latest Discovered Content */}
        {status.latestContent.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-blue-900">Latest discoveries:</h4>
            <div className="space-y-2">
              {status.latestContent.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-blue-100"
                >
                  <span className="text-lg">{getTypeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({item.relevanceScore}/10)
                      </span>
                    </div>
                  </div>
                  {getStatusIcon(item.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discovery Message */}
        {status.isDiscoveryActive ? (
          <div className="text-sm text-blue-700 bg-blue-100/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>DeepSeek is actively discovering relevant content for this group...</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-green-700 bg-green-100/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Discovery complete! {status.totalDiscovered} items found.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
