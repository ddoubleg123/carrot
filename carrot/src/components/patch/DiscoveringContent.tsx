'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, ExternalLink, Filter, SortAsc } from 'lucide-react';
import telemetry from '@/lib/telemetry';
import DiscoveryCard from '@/app/patch/[handle]/components/DiscoveryCard';
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

export default function DiscoveringContent({ patchHandle }: DiscoveringContentProps) {
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [firstItemTime, setFirstItemTime] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'quality'>('relevance');
  const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'pdf' | 'post'>('all');

  const handleStartDiscovery = async () => {
    console.log('[Discovery] Button clicked - starting discovery for patch:', patchHandle);
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[Discovery] Making POST request to start-discovery API...');
      // Call the DeepSeek-powered discovery API
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
        
        // Handle specific error cases
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
        return;
      }
      
      const data = await response.json();
      console.log('[Discovery] API response received:', data);
      
      // Start polling for results
      setIsDiscovering(true);
      loadDiscoveredContent();
      
    } catch (err) {
      console.error('Error starting discovery:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    telemetry.trackDiscoveryStarted(patchHandle);
    
    // Try to load existing content first
    loadDiscoveredContent();
    
    // Set up polling for new content
    const interval = setInterval(loadDiscoveredContent, 10000); // Reduced frequency
    return () => clearInterval(interval);
  }, [patchHandle]);

  const loadDiscoveredContent = async () => {
    try {
      console.log('[Discovery] Loading discovered content for patch:', patchHandle);
      // Add cache-busting parameter to force fresh data
      const cacheBuster = `t=${Date.now()}`;
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      console.log('[Discovery] API response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[Discovery] API response data:', data);
        
        // Safety check: ensure data.items is an array and transform to unified format
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const newItems = rawItems.map(transformToDiscoveredItem);
        console.log('[Discovery] Processed items:', newItems.length, 'items');
        
        // Log when new items are found
        if (newItems.length > items.length) {
          console.log(`[Discovery] Found ${newItems.length} items (was ${items.length})`, newItems);
        }
        
        // Track first item discovery
        if (newItems.length > 0 && items.length === 0 && firstItemTime === null) {
          const timeToFirstItem = performance.now();
          setFirstItemTime(timeToFirstItem);
          telemetry.trackDiscoveryFirstItem(patchHandle, timeToFirstItem);
          console.log('[Discovery] First item discovered!', newItems[0]);
        }
        
        setItems(newItems);
        setIsDiscovering(data?.isActive || false);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Discovery] API error:', response.status, errorData);
        console.error('[Discovery] Full error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          patchHandle
        });
        
        // Only show error if we don't have any items yet
        if (items.length === 0) {
          let errorMessage = 'Unknown error';
          let errorCode = 'UNKNOWN_ERROR';
          
          if (response.status === 404) {
            errorMessage = 'Patch not found. Please refresh the page.';
            errorCode = 'PATCH_NOT_FOUND';
          } else if (response.status === 500) {
            if (errorData.code === 'MISSING_API_KEY') {
              errorMessage = 'Discovery service is not configured. Please contact support.';
              errorCode = 'MISSING_API_KEY';
            } else if (errorData.code === 'DEEPSEEK_API_ERROR') {
              errorMessage = `Discovery service error (${errorData.status}). Please try again later.`;
              errorCode = 'DEEPSEEK_API_ERROR';
            } else {
              errorMessage = `Server error: ${errorData.details || errorData.error || 'Unknown error'}`;
              errorCode = 'SERVER_ERROR';
            }
          } else {
            errorMessage = `We couldn't check sources (${response.status}). Retry.`;
            errorCode = `HTTP_${response.status}`;
          }
          
          setError(errorMessage);
          telemetry.trackDiscoveryError(patchHandle, `${errorCode}: ${errorMessage}`);
        }
      }
    } catch (err) {
      console.error('[Discovery] Error loading content:', err);
      
      // Only show error if we don't have any items yet
      if (items.length === 0) {
        setError('Connection lost. We\'ll keep trying.');
        telemetry.trackDiscoveryError(patchHandle, 'Network error');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  if (isLoading) {
    return (
      <div style={{
        padding: TOKENS.spacing.xl,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: TOKENS.spacing.md, marginBottom: TOKENS.spacing.lg }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `2px solid ${TOKENS.colors.line}`,
            borderTopColor: TOKENS.colors.actionOrange,
            animation: 'spin 1s linear infinite'
          }} />
          <h3 style={{
            fontSize: TOKENS.typography.h3,
            fontWeight: 600,
            color: TOKENS.colors.ink,
            margin: 0
          }}>
            Discovering content
          </h3>
        </div>
        <p style={{
          fontSize: TOKENS.typography.body,
          color: TOKENS.colors.slate,
          margin: 0,
          marginBottom: TOKENS.spacing.lg
        }}>
          We're actively finding posts, videos, and drills that match this group. New items will appear here.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.md }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              padding: TOKENS.spacing.lg,
              border: `1px solid ${TOKENS.colors.line}`,
              borderRadius: TOKENS.radii.md,
              background: '#f9f9f9'
            }}>
              <div style={{
                height: '16px',
                background: TOKENS.colors.line,
                borderRadius: TOKENS.radii.sm,
                marginBottom: TOKENS.spacing.sm,
                width: '60%'
              }} />
              <div style={{
                height: '12px',
                background: TOKENS.colors.line,
                borderRadius: TOKENS.radii.sm,
                width: '40%'
              }} />
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: TOKENS.spacing.xl,
        border: `1px solid ${TOKENS.colors.danger}`,
        borderRadius: TOKENS.radii.lg,
        background: '#FEF2F2'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: TOKENS.spacing.md, marginBottom: TOKENS.spacing.lg }}>
          <AlertCircle size={24} color={TOKENS.colors.danger} />
          <h3 style={{
            fontSize: TOKENS.typography.h3,
            fontWeight: 600,
            color: TOKENS.colors.danger,
            margin: 0
          }}>
            Discovery Error
          </h3>
        </div>
        <p style={{
          fontSize: TOKENS.typography.body,
          color: TOKENS.colors.danger,
          margin: 0,
          marginBottom: TOKENS.spacing.lg
        }}>
          {error}
        </p>
        {error.includes('configuration error') && (
          <div style={{
            padding: TOKENS.spacing.md,
            background: '#FEF3C7',
            border: `1px solid ${TOKENS.colors.warning}`,
            borderRadius: TOKENS.radii.md,
            marginBottom: TOKENS.spacing.lg
          }}>
            <p style={{
              fontSize: TOKENS.typography.caption,
              color: TOKENS.colors.warning,
              margin: 0,
              fontWeight: 600
            }}>
              💡 Setup Required: Add DEEPSEEK_API_KEY to your environment variables
            </p>
            <p style={{
              fontSize: TOKENS.typography.caption,
              color: TOKENS.colors.slate,
              margin: 0,
              marginTop: TOKENS.spacing.xs
            }}>
              See DISCOVERY_SETUP_GUIDE.md for detailed instructions
            </p>
          </div>
        )}
        <button
          onClick={handleRetry}
          style={{
            padding: `${TOKENS.spacing.md} ${TOKENS.spacing.lg}`,
            border: 'none',
            borderRadius: TOKENS.radii.md,
            background: TOKENS.colors.danger,
            color: TOKENS.colors.surface,
            fontSize: TOKENS.typography.body,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: TOKENS.spacing.sm,
            transition: `all ${TOKENS.motion.normal} ease-in-out`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#DC2626';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = TOKENS.colors.danger;
          }}
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0 && !error) {
    return (
      <div style={{
        padding: TOKENS.spacing.xl,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface,
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: TOKENS.spacing.lg }}>
          <Search size={48} color={TOKENS.colors.slate} />
        </div>
        <h3 style={{
          fontSize: TOKENS.typography.h3,
          fontWeight: 600,
          color: TOKENS.colors.ink,
          margin: 0,
          marginBottom: TOKENS.spacing.sm
        }}>
          Discovery In Process
        </h3>
        <p style={{
          fontSize: TOKENS.typography.body,
          color: TOKENS.colors.slate,
          margin: 0,
          marginBottom: TOKENS.spacing.lg
        }}>
          Carrot is searching for relevant content about this group...
        </p>
        <div style={{
          fontSize: TOKENS.typography.caption,
          color: TOKENS.colors.slate,
          marginBottom: TOKENS.spacing.lg,
          fontStyle: 'italic'
        }}>
          Items found: {items.length} | Status: {isDiscovering ? 'Searching...' : 'Processing...'}
        </div>
        <button
          onClick={handleStartDiscovery}
          disabled={isLoading}
          style={{
            padding: `${TOKENS.spacing.md} ${TOKENS.spacing.lg}`,
            border: 'none',
            borderRadius: TOKENS.radii.md,
            background: TOKENS.colors.actionOrange,
            color: TOKENS.colors.surface,
            fontSize: TOKENS.typography.body,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: TOKENS.spacing.sm,
            margin: '0 auto',
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: `2px solid ${TOKENS.colors.surface}`,
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }} />
              Starting Discovery...
            </>
          ) : (
            <>
              <Search size={16} />
              Start Content Discovery
            </>
          )}
        </button>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      padding: TOKENS.spacing.xl,
      border: `1px solid ${TOKENS.colors.line}`,
      borderRadius: TOKENS.radii.lg,
      background: TOKENS.colors.surface
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: TOKENS.spacing.md, marginBottom: TOKENS.spacing.lg }}>
        {isDiscovering && (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `2px solid ${TOKENS.colors.line}`,
            borderTopColor: TOKENS.colors.actionOrange,
            animation: 'spin 1s linear infinite'
          }} />
        )}
        <h3 style={{
          fontSize: TOKENS.typography.h3,
          fontWeight: 600,
          color: TOKENS.colors.ink,
          margin: 0
        }}>
          Discovering content
        </h3>
        {isDiscovering && (
          <span style={{
            padding: `${TOKENS.spacing.xs} ${TOKENS.spacing.sm}`,
            background: TOKENS.colors.actionOrange,
            color: TOKENS.colors.surface,
            borderRadius: TOKENS.radii.sm,
            fontSize: TOKENS.typography.caption,
            fontWeight: 600
          }}>
            LIVE
          </span>
        )}
      </div>
      
      <p style={{
        fontSize: TOKENS.typography.body,
        color: TOKENS.colors.slate,
        margin: 0,
        marginBottom: TOKENS.spacing.lg
      }}>
        We're actively finding posts, videos, and drills that match this group. New items will appear here.
      </p>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {getSortedAndFilteredItems().map((item) => {
          // Safety check: ensure item has all required properties
          if (!item || typeof item !== 'object') {
            console.warn('[Discovery] Invalid item:', item);
            return null;
          }
          
          return (
            <DiscoveryCard
              key={item.id || Math.random()}
              item={item}
              onOpenModal={(selectedItem) => {
                // TODO: Implement modal
                console.log('[Discovery] Open modal for:', selectedItem.title)
              }}
            />
          );
        })}
      </div>

      {/* Empty State */}
      {getSortedAndFilteredItems().length === 0 && (
        <div className="text-center py-12">
          <Search size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
          <p className="text-gray-500">
            {filterType === 'all' 
              ? 'No content has been discovered yet. Check back soon!'
              : `No ${filterType}s found. Try changing the filter.`
            }
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
