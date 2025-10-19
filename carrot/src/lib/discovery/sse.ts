/**
 * Server-Sent Events for Discovery System
 * 
 * Provides real-time updates for discovery progress:
 * - state: current phase
 * - found: count of items found
 * - progress: completion status
 * - item-ready: new item discovered
 * - error: error messages
 * - complete: discovery finished
 */

import { NextRequest } from 'next/server';

export interface SSEMessage {
  event: string;
  data: any;
  id?: string;
}

export interface DiscoverySSEState {
  phase: 'searching' | 'processing' | 'paused' | 'completed' | 'error';
  found: number;
  total: number;
  done: number;
  live: boolean;
  error?: string;
}

/**
 * SSE Manager for Discovery
 */
export class DiscoverySSE {
  private controller: ReadableStreamDefaultController;
  private state: DiscoverySSEState;
  
  constructor(controller: ReadableStreamDefaultController) {
    this.controller = controller;
    this.state = {
      phase: 'searching',
      found: 0,
      total: 10,
      done: 0,
      live: true
    };
  }
  
  /**
   * Send SSE message
   */
  send(event: string, data: any, id?: string): void {
    const message: SSEMessage = { event, data, id };
    const sseData = `event: ${event}\ndata: ${JSON.stringify(data)}${id ? `\nid: ${id}` : ''}\n\n`;
    
    try {
      this.controller.enqueue(new TextEncoder().encode(sseData));
    } catch (error) {
      console.error('[SSE] Error sending message:', error);
    }
  }
  
  /**
   * Send state update
   */
  sendState(phase: DiscoverySSEState['phase'], error?: string): void {
    this.state.phase = phase;
    if (error) this.state.error = error;
    
    this.send('state', {
      phase: this.state.phase,
      found: this.state.found,
      total: this.state.total,
      done: this.state.done,
      live: this.state.live,
      error: this.state.error
    });
  }
  
  /**
   * Send found count update
   */
  sendFound(count: number): void {
    this.state.found = count;
    this.send('found', { count });
  }
  
  /**
   * Send progress update
   */
  sendProgress(done: number, total: number): void {
    this.state.done = done;
    this.state.total = total;
    this.send('progress', { done, total });
  }
  
  /**
   * Send item ready
   */
  sendItemReady(item: any): void {
    this.send('item-ready', {
      id: item.id,
      type: item.type,
      title: item.title,
      displayTitle: item.title,
      url: item.url,
      canonicalUrl: item.canonicalUrl,
      status: 'ready',
      media: {
        hero: item.mediaAssets?.hero,
        source: item.mediaAssets?.source || 'generated',
        license: item.mediaAssets?.license || 'generated'
      },
      content: {
        summary150: item.enrichedContent?.summary?.substring(0, 150) || '',
        keyPoints: item.enrichedContent?.keyPoints || [],
        readingTimeMin: item.enrichedContent?.readingTimeMin || 1
      },
      meta: {
        sourceDomain: item.metadata?.sourceDomain || 'unknown',
        publishDate: item.metadata?.publishDate || item.createdAt
      }
    });
  }
  
  /**
   * Send error
   */
  sendError(message: string): void {
    this.state.phase = 'error';
    this.state.error = message;
    this.send('error', { message });
  }
  
  /**
   * Send completion
   */
  sendComplete(done: number): void {
    this.state.phase = 'completed';
    this.state.done = done;
    this.state.live = false;
    this.send('complete', { done });
  }
  
  /**
   * Send heartbeat
   */
  sendHeartbeat(): void {
    this.send('heartbeat', {});
  }
  
  /**
   * Close SSE connection
   */
  close(): void {
    try {
      this.controller.close();
    } catch (error) {
      console.error('[SSE] Error closing connection:', error);
    }
  }
}

/**
 * Create SSE response
 */
export function createSSEResponse(handler: (sse: DiscoverySSE) => Promise<void>): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sse = new DiscoverySSE(controller);
      
      // Start handler
      handler(sse).catch(error => {
        console.error('[SSE] Handler error:', error);
        sse.sendError(error.message);
        sse.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

/**
 * Parse SSE request
 */
export function parseSSERequest(request: NextRequest): {
  groupId: string;
  batchSize: number;
  stream: boolean;
} {
  const url = new URL(request.url);
  const groupId = url.pathname.split('/')[3]; // /api/patches/[handle]/discovery/stream
  const batchSize = parseInt(url.searchParams.get('batch') || '10');
  const stream = url.searchParams.get('stream') === 'true';
  
  return { groupId, batchSize, stream };
}
