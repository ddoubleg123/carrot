/**
 * React Hook for Discovery Stream
 * 
 * Consumes SSE stream from discovery API and manages state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DiscoveredItem } from '@/types/discovered-content';

export interface DiscoveryState {
  phase: 'idle' | 'searching' | 'processing' | 'paused' | 'completed' | 'error';
  found: number;
  total: number;
  done: number;
  live: boolean;
  error?: string;
}

export interface UseDiscoveryStreamOptions {
  patchHandle: string;
  batchSize?: number;
  autoStart?: boolean;
}

export interface UseDiscoveryStreamReturn {
  // State
  state: DiscoveryState;
  items: DiscoveredItem[];
  
  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  refresh: () => void;
  
  // Status
  isConnected: boolean;
  isRunning: boolean;
  hasError: boolean;
}

/**
 * Hook for consuming discovery SSE stream
 */
export function useDiscoveryStream(options: UseDiscoveryStreamOptions): UseDiscoveryStreamReturn {
  const { patchHandle, batchSize = 10, autoStart = false } = options;
  
  // State
  const [state, setState] = useState<DiscoveryState>({
    phase: 'idle',
    found: 0,
    total: batchSize,
    done: 0,
    live: false
  });
  
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Start discovery
  const start = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const url = `/api/patches/${patchHandle}/discovery/stream?batch=${batchSize}&stream=true`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    setIsConnected(true);
    setHasError(false);
    setState(prev => ({ ...prev, phase: 'searching', live: true }));
    
    // Handle events
    eventSource.onopen = () => {
      console.log('[Discovery] SSE connection opened');
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Discovery] Received message:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing message:', error);
      }
    };
    
    eventSource.addEventListener('state', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, ...data }));
        console.log('[Discovery] State update:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing state:', error);
      }
    });
    
    eventSource.addEventListener('found', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, found: data.count }));
        console.log('[Discovery] Found update:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing found:', error);
      }
    });
    
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, done: data.done, total: data.total }));
        console.log('[Discovery] Progress update:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing progress:', error);
      }
    });
    
    eventSource.addEventListener('item-ready', (event) => {
      try {
        const data = JSON.parse(event.data);
        const newItem: DiscoveredItem = {
          id: data.id,
          type: data.type,
          title: data.title,
          displayTitle: data.displayTitle,
          url: data.url,
          canonicalUrl: data.canonicalUrl,
          status: data.status,
          media: data.media,
          content: data.content,
          meta: data.meta
        };
        
        setItems(prev => [newItem, ...prev]);
        console.log('[Discovery] New item ready:', newItem);
      } catch (error) {
        console.error('[Discovery] Error parsing item-ready:', error);
      }
    });
    
    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, phase: 'error', error: data.message }));
        setHasError(true);
        console.error('[Discovery] Error event:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing error event:', error);
      }
    });
    
    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, phase: 'completed', live: false }));
        console.log('[Discovery] Complete:', data);
      } catch (error) {
        console.error('[Discovery] Error parsing complete:', error);
      }
    });
    
    eventSource.addEventListener('heartbeat', () => {
      // Keep connection alive
      console.log('[Discovery] Heartbeat received');
    });
    
    eventSource.onerror = (error) => {
      console.error('[Discovery] SSE error:', error);
      setIsConnected(false);
      setHasError(true);
      
      // Attempt reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[Discovery] Attempting reconnection...');
        start();
      }, 5000);
    };
    
  }, [patchHandle, batchSize]);
  
  // Pause discovery
  const pause = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setState(prev => ({ ...prev, phase: 'paused', live: false }));
    setIsConnected(false);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  // Resume discovery
  const resume = useCallback(() => {
    start();
  }, [start]);
  
  // Restart discovery
  const restart = useCallback(() => {
    setItems([]);
    setState(prev => ({ ...prev, found: 0, done: 0, error: undefined }));
    setHasError(false);
    start();
  }, [start]);
  
  // Refresh items
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content`);
      if (response.ok) {
        const data = await response.json();
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch (error) {
      console.error('[Discovery] Refresh error:', error);
    }
  }, [patchHandle]);
  
  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [autoStart, start]);
  
  // Load existing items on mount
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return {
    state,
    items,
    start,
    pause,
    resume,
    restart,
    refresh,
    isConnected,
    isRunning: state.live,
    hasError
  };
}