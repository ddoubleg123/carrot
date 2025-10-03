'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import telemetry from '@/lib/telemetry';

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

interface DiscoveredItem {
  id: string;
  type: 'post' | 'video' | 'document' | 'source';
  title: string;
  content: string;
  sourceUrl?: string;
  relevanceScore: number;
  status: 'pending' | 'audited' | 'approved' | 'rejected';
  createdAt: string;
}

interface DiscoveringContentProps {
  patchHandle: string;
}

export default function DiscoveringContent({ patchHandle }: DiscoveringContentProps) {
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [firstItemTime, setFirstItemTime] = useState<number | null>(null);

  useEffect(() => {
    telemetry.trackDiscoveryStarted(patchHandle);
    
    loadDiscoveredContent();
    
    // Set up polling for new content
    const interval = setInterval(loadDiscoveredContent, 5000);
    return () => clearInterval(interval);
  }, [patchHandle]);

  const loadDiscoveredContent = async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content`);
      if (response.ok) {
        const data = await response.json();
        const newItems = data.items || [];
        
        // Track first item discovery
        if (newItems.length > 0 && items.length === 0 && firstItemTime === null) {
          const timeToFirstItem = performance.now();
          setFirstItemTime(timeToFirstItem);
          telemetry.trackDiscoveryFirstItem(patchHandle, timeToFirstItem);
        }
        
        setItems(newItems);
        setIsDiscovering(data.isActive || false);
        setError(null);
      } else {
        setError('We couldn\'t check sources. Retry.');
        telemetry.trackDiscoveryError(patchHandle, 'API request failed');
      }
    } catch (err) {
      setError('Connection lost. We\'ll keep trying.');
      telemetry.trackDiscoveryError(patchHandle, 'Network error');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return TOKENS.colors.success;
      case 'rejected': return TOKENS.colors.danger;
      case 'audited': return TOKENS.colors.warning;
      default: return TOKENS.colors.slate;
    }
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

  const handleStartDiscovery = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
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
        throw new Error('Failed to start content discovery');
      }
      
      const data = await response.json();
      console.log('Discovery started:', data);
      
      // Start polling for results
      setIsDiscovering(true);
      loadDiscoveredContent();
      
    } catch (err) {
      console.error('Error starting discovery:', err);
      setError('Failed to start content discovery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
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
          No content discovered yet
        </h3>
        {/* Force rebuild - v2 */}
        <p style={{
          fontSize: TOKENS.typography.body,
          color: TOKENS.colors.slate,
          margin: 0,
          marginBottom: TOKENS.spacing.lg
        }}>
          Start learning about this topic with AI-powered content discovery.
        </p>
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
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: TOKENS.spacing.sm,
            margin: '0 auto',
            transition: `all ${TOKENS.motion.normal} ease-in-out`,
            opacity: isLoading ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = '#E55A00';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = TOKENS.colors.actionOrange;
            }
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
              Start Learning
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.md }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: TOKENS.spacing.lg,
              border: `1px solid ${TOKENS.colors.line}`,
              borderRadius: TOKENS.radii.md,
              background: TOKENS.colors.surface,
              transition: `all ${TOKENS.motion.normal} ease-in-out`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = TOKENS.colors.civicBlue;
              e.currentTarget.style.boxShadow = `0 2px 8px rgba(10, 90, 255, 0.1)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = TOKENS.colors.line;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: TOKENS.spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: TOKENS.spacing.sm }}>
                <span style={{ fontSize: '16px' }}>{getTypeIcon(item.type)}</span>
                <span style={{
                  fontSize: TOKENS.typography.caption,
                  color: TOKENS.colors.slate,
                  fontWeight: 500
                }}>
                  {getTypeLabel(item.type)}
                </span>
                <span style={{
                  padding: `${TOKENS.spacing.xs} ${TOKENS.spacing.sm}`,
                  background: getStatusColor(item.status),
                  color: TOKENS.colors.surface,
                  borderRadius: TOKENS.radii.sm,
                  fontSize: TOKENS.typography.caption,
                  fontWeight: 600
                }}>
                  {item.status}
                </span>
              </div>
              <div style={{
                fontSize: TOKENS.typography.caption,
                color: TOKENS.colors.slate
              }}>
                {Math.round(item.relevanceScore * 100)}% match
              </div>
            </div>
            
            <h4 style={{
              fontSize: TOKENS.typography.body,
              fontWeight: 600,
              color: TOKENS.colors.ink,
              margin: 0,
              marginBottom: TOKENS.spacing.sm
            }}>
              {item.title}
            </h4>
            
            <p style={{
              fontSize: TOKENS.typography.body,
              color: TOKENS.colors.slate,
              margin: 0,
              marginBottom: TOKENS.spacing.sm,
              lineHeight: 1.5
            }}>
              {item.content.length > 150 ? `${item.content.substring(0, 150)}...` : item.content}
            </p>
            
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: TOKENS.typography.caption,
                  color: TOKENS.colors.civicBlue,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: TOKENS.spacing.xs
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                <ExternalLink size={12} />
                View source
              </a>
            )}
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
