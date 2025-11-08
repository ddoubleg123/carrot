'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, RefreshCw, AlertCircle, ExternalLink, Filter, SortAsc } from 'lucide-react';
import telemetry from '@/lib/telemetry';
import DiscoveryCard from '@/app/(app)/patch/[handle]/components/DiscoveryCard';
import { DiscoveredItem } from '@/types/discovered-content';

// Design tokens from Carrot standards
const TOKENS = {
  colors: {
    actionOrange: '#FF6A00',
    civicBlue: '#0A5AFF',
    ink: '#0B0B0F',
    slate: '#60646C',
    line: '#E6E8EC',
    surface: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radii: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '20px',
  },
  motion: {
    fast: '120ms',
    normal: '160ms',
    slow: '180ms',
  },
  typography: {
    h3: '20px',
    body: '16px',
    caption: '12px',
  }
};

// Using unified DiscoveredItem type from @/types/discovered-content

interface DiscoveringContentProps {
  patchHandle: string;
}

// Transform API data to unified DiscoveredItem format
const transformToDiscoveredItem = (apiItem: any): DiscoveredItem => {
  // Extract domain from URL for favicon
  const getDomain = (url?: string) => {
    if (!url) return 'unknown';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  };

  return {
    id: apiItem.id || `item-${Math.random()}`,
    type: apiItem.type || 'article',
    title: apiItem.title || 'Untitled',
    url: apiItem.url || apiItem.sourceUrl || '',
    matchPct: apiItem.relevanceScore || apiItem.relevance_score || 0.8,
    status: apiItem.status === 'pending_audit' ? 'pending_audit' : 
            apiItem.status === 'requires_review' ? 'pending_audit' : 
            (apiItem.status as any) || 'ready',
    media: {
      hero: apiItem.mediaAssets?.hero || 
            apiItem.enrichedContent?.hero || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent((apiItem.title || 'Content').substring(0, 30))}&background=FF6A00&color=fff&size=800&format=png&bold=true`,
      gallery: apiItem.mediaAssets?.gallery || [],
      videoThumb: apiItem.mediaAssets?.videoThumb,
      pdfPreview: apiItem.mediaAssets?.pdfPreview
    },
    content: {
      summary150: apiItem.enrichedContent?.summary150 || 
                  apiItem.description || 
                  apiItem.content?.substring(0, 150) + '...' || 
                  'No summary available',
      keyPoints: apiItem.enrichedContent?.keyPoints || 
                 apiItem.tags?.slice(0, 5) || 
                 ['Key information available'],
      notableQuote: apiItem.enrichedContent?.notableQuote,
      readingTimeMin: apiItem.metadata?.readingTime || 
                      apiItem.enrichedContent?.readingTime || 
                      Math.max(1, Math.floor((apiItem.content?.length || 1000) / 200))
    },
    meta: {
      sourceDomain: getDomain(apiItem.url || apiItem.sourceUrl),
      author: apiItem.metadata?.author || 
              apiItem.author || 
              apiItem.enrichedContent?.author,
      publishDate: apiItem.metadata?.publishDate || 
                   apiItem.publishDate || 
                   apiItem.createdAt
    }
  };
};

type DiscoverySseEvent =
  | { type: 'start'; data?: { groupId?: string; runId?: string }; message?: string; timestamp: number }
  | { type: 'searching'; data?: { source?: string }; timestamp: number }
  | { type: 'candidate'; data?: { url?: string; title?: string }; timestamp: number }
  | { type: 'enriched'; data?: { title?: string; summary?: string }; timestamp: number }
  | { type: 'hero_ready'; data?: { heroUrl?: string; source?: string }; timestamp: number }
  | { type: 'saved'; data?: { item: any }; timestamp: number }
  | { type: 'idle'; message?: string; timestamp: number }
  | { type: 'stop'; timestamp: number }
  | { type: 'error'; data?: any; message?: string; timestamp: number }
  | { type: 'skipped:duplicate' | 'skipped:low_relevance' | 'skipped:near_dup'; data?: any; timestamp: number };

export default function DiscoveringContent({ patchHandle }: DiscoveringContentProps) {
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [firstItemTime, setFirstItemTime] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'quality'>('relevance');
  const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'pdf' | 'post'>('all');
  const [runId, setRunId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start discovery');
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleSseEvent = useCallback((event: DiscoverySseEvent) => {
    switch (event.type) {
      case 'start':
        setStatusMessage('Discovery engine started…');
        break;
      case 'searching':
        setStatusMessage(`Searching ${event.data?.source || 'sources'}…`);
        break;
      case 'candidate':
        setStatusMessage(`Evaluating ${event.data?.title || event.data?.url || 'candidate'}…`);
        break;
      case 'enriched':
        setStatusMessage(`Synthesizing ${event.data?.title || 'candidate'}…`);
        break;
      case 'hero_ready':
        setStatusMessage('Hero image ready');
        break;
      case 'skipped:duplicate':
        setStatusMessage('Skipped duplicate candidate');
        break;
      case 'skipped:low_relevance':
        setStatusMessage('Skipped low relevance candidate');
        break;
      case 'skipped:near_dup':
        setStatusMessage('Skipped near-duplicate candidate');
        break;
      case 'saved':
        setStatusMessage('Saved new content');
        if (event.data?.item) {
          const newItem = transformToDiscoveredItem(event.data.item);
          setItems(prev => [newItem, ...prev]);
          if (firstItemTime === null) {
            const now = performance.now();
            setFirstItemTime(now);
            telemetry.trackDiscoveryFirstItem(patchHandle, now);
          }
        }
        break;
      case 'idle':
        setStatusMessage(event.message || 'Discovery idle');
        setIsDiscovering(false);
        break;
      case 'stop':
        setStatusMessage('Discovery complete');
        setIsDiscovering(false);
        break;
      case 'error':
        console.error('[Discovery SSE] Error event', event);
        setStatusMessage(event.message || 'Discovery error');
        setIsDiscovering(false);
        if (event.data?.error) {
          setError(`Discovery error: ${event.data.error}`);
        }
        break;
      default:
        break;
    }
  }, [firstItemTime, patchHandle]);

  const startEventStream = useCallback((id: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const source = new EventSource(`/api/patches/${patchHandle}/discovery/stream?runId=${encodeURIComponent(id)}`);
    eventSourceRef.current = source;

    source.onmessage = (evt) => {
      try {
        const parsed: DiscoverySseEvent = JSON.parse(evt.data);
        handleSseEvent(parsed);
      } catch (err) {
        console.error('[Discovery SSE] Failed to parse event payload', err, evt.data);
      }
    };

    source.onerror = (err) => {
      console.error('[Discovery SSE] Stream error', err);
      setStatusMessage('Discovery stream disconnected');
      setIsDiscovering(false);
      source.close();
      eventSourceRef.current = null;
    };
  }, [patchHandle, handleSseEvent]);

  const handleStartDiscovery = useCallback(async () => {
    console.log('[Discovery] Button clicked - starting discovery for patch:', patchHandle);
    try {
      setIsLoading(true);
      setError(null);
      setStatusMessage('Starting discovery…');

      const response = await fetch(`/api/patches/${patchHandle}/start-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_deepseek_search'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Discovery API error:', response.status, errorData);

        if (response.status === 401) {
          setError('Please log in to start content discovery.');
        } else if (response.status === 403) {
          setError('You don\'t have permission to start discovery for this patch.');
        } else if (response.status === 404) {
          setError('Patch not found. Please refresh the page.');
        } else if (response.status === 500) {
          setError('Discovery service configuration error. Please check API keys and try again.');
        } else {
          setError('Discovery service is temporarily unavailable. Please try again later.');
        }
        setStatusMessage('Discovery failed to start');
        return;
      }

      const data = await response.json();
      console.log('[Discovery] API response received:', data);

      if (!data?.runId) {
        setError('Discovery did not return a run identifier. Please try again.');
        setStatusMessage('Missing run identifier');
        return;
      }

      setRunId(data.runId);
      setIsDiscovering(true);
      setStatusMessage('Connecting to live discovery stream...');
      startEventStream(data.runId);
      loadDiscoveredContent();
    } catch (err) {
      console.error('Error starting discovery:', err);
      setError('Network error. Please check your connection and try again.');
      setStatusMessage('Discovery failed to start');
    } finally {
      setIsLoading(false);
    }
  }, [patchHandle, startEventStream, loadDiscoveredContent]);

  const loadDiscoveredContent = useCallback(async () => {
    try {
      const cacheBuster = `t=${Date.now()}`;
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const hydrated = rawItems.map(transformToDiscoveredItem);
        setItems(hydrated);
        setError(null);
        setIsDiscovering(Boolean(data?.isActive));
      } else {
        if (items.length === 0) {
          setError('Failed to load discovery results. Please try again.');
        }
      }
    } catch (err) {
      console.error('[Discovery] Error loading content', err);
      if (items.length === 0) {
        setError('Network error while loading discovery results.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [patchHandle, items.length]);

  useEffect(() => {
    telemetry.trackDiscoveryStarted(patchHandle);
    loadDiscoveredContent();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [patchHandle, loadDiscoveredContent]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    loadDiscoveredContent();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥';
      case 'document': return '📄';
      case 'source': return '🔗';
      default: return '📝';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'video': return 'Video';
      case 'document': return 'Document';
      case 'source': return 'Source';
      default: return 'Post';
    }
  };

  // Sort and filter items
  const getSortedAndFilteredItems = () => {
    let filtered = items.filter(item => {
      if (filterType === 'all') return true;
      return item.type === filterType;
    });

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.matchPct || 0) - (a.matchPct || 0);
        case 'newest':
          return new Date(b.meta.publishDate || 0).getTime() - new Date(a.meta.publishDate || 0).getTime();
        case 'quality':
          // Use match percentage as quality proxy for now
          return (b.matchPct || 0) - (a.matchPct || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const handleAttach = (itemId: string, type: 'timeline' | 'fact' | 'source') => {
    console.log(`Attaching item ${itemId} to ${type}`);
    // TODO: Implement attachment logic
  };

  const handleDiscuss = (itemId: string) => {
    console.log(`Opening discussion for item ${itemId}`);
    // TODO: Implement discussion logic
  };

  const handleSave = (itemId: string) => {
    console.log(`Saving item ${itemId}`);
    // TODO: Implement save logic
  };

const showSpinner = isDiscovering || (isLoading && items.length === 0);

const skeletonTile = (
  <div className="relative h-full border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-orange-100/60 via-white to-orange-50/60" />
    <div className="relative p-6 h-full flex flex-col justify-between">
      <div>
        <div className="h-48 rounded-xl bg-gray-100 animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map(key => (
              <div key={key} className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-orange-400 mt-1 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded animate-pulse flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        Preparing next card…
      </div>
    </div>
  </div>
);

const rightColumnContent = () => {
  if (showSpinner || isDiscovering) {
    return skeletonTile;
  }

  if (items.length === 0) {
    return (
      <div className="h-full border border-gray-200 rounded-2xl bg-white shadow-sm flex items-center justify-center text-sm text-gray-500">
        Start discovery to preview the next card.
      </div>
    );
  }

  return (
    <div className="h-full border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col justify-center items-center text-sm text-gray-500 p-6">
      <span className="font-medium text-gray-700 mb-1">Discovery idle</span>
      <span className="text-gray-500 text-center">
        Launch discovery to stream the next piece of content here in real time.
      </span>
    </div>
  );
};

const filtersBar = (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-gray-500" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
        >
          <option value="all">All Types</option>
          <option value="article">Articles</option>
          <option value="video">Videos</option>
          <option value="pdf">PDFs</option>
          <option value="post">Posts</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <SortAsc size={16} className="text-gray-500" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
        >
          <option value="relevance">Top</option>
          <option value="newest">Newest</option>
          <option value="quality">Quality</option>
        </select>
      </div>
    </div>
    <div className="text-sm text-gray-500">
      {getSortedAndFilteredItems().length} items
    </div>
  </div>
);

const livePanel = (
  <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm space-y-4">
    <div className="flex items-center gap-3">
      {showSpinner && (
        <div className="w-5 h-5 rounded-full border-2 border-orange-200 border-t-transparent animate-spin" />
      )}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Discovery Live</h3>
        <p className={`text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || statusMessage}
        </p>
      </div>
      {(isDiscovering || showSpinner) && (
        <span className="ml-auto px-2 py-1 text-xs font-semibold bg-orange-500 text-white rounded-md">
          LIVE
        </span>
      )}
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={handleStartDiscovery}
        disabled={isDiscovering || isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 disabled:opacity-60"
      >
        {isDiscovering ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
        {isDiscovering ? 'Discovery Running…' : 'Start Discovery'}
      </button>
      <button
        onClick={loadDiscoveredContent}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        <RefreshCw size={14} />
        Refresh
      </button>
      {error && (
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          <AlertCircle size={14} />
          Resolve Error
        </button>
      )}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-500">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">Items Saved</div>
        <div className="text-lg font-semibold text-gray-900">{items.length}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">Time to First</div>
        <div className="text-lg font-semibold text-gray-900">
          {firstItemTime ? `${(firstItemTime / 1000).toFixed(1)}s` : '—'}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">Status</div>
        <div className="text-lg font-semibold text-gray-900">
          {isDiscovering ? 'Running' : 'Idle'}
        </div>
      </div>
    </div>
  </div>
);

const sortedItems = getSortedAndFilteredItems();

return (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {livePanel}
      {rightColumnContent()}
    </div>

    {filtersBar}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {sortedItems.map((item, index) => {
        if (!item || typeof item !== 'object') {
          console.warn('[Discovery] Invalid item:', item);
          return null;
        }
        return (
          <DiscoveryCard
            key={item.id || `discovery-${index}`}
            item={item}
            onHeroClick={(selectedItem) => {
              console.log('[Discovery] Open modal for:', selectedItem.title);
            }}
          />
        );
      })}
    </div>

    {sortedItems.length === 0 && (
      <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
        <Search size={48} className="text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No content discovered yet</h3>
        <p className="text-gray-500">
          {filterType === 'all'
            ? 'Start discovery to fetch the latest cards for this patch.'
            : `No ${filterType}s found. Try adjusting the filters.`}
        </p>
      </div>
    )}
  </div>
);
}
