/**
 * Discovery Stream API Route
 * 
 * Provides SSE streaming for real-time discovery updates
 * Integrates all discovery components:
 * - Multi-tier deduplication
 * - Search frontier
 * - One-at-a-time processing
 * - AI image generation
 */

import { NextRequest } from 'next/server';
import { createSSEResponse, DiscoverySSE, parseSSERequest } from '@/lib/discovery/sse';
import { DiscoveryLoop } from '@/lib/discovery/discovery-loop';
import { SearchFrontier } from '@/lib/discovery/frontier';
import { checkRedisHealth } from '@/lib/discovery/redis';
import prisma from '@/lib/prisma';

/**
 * GET /api/patches/[handle]/discovery/stream
 * 
 * Streams real-time discovery updates via Server-Sent Events
 */
export async function GET(request: NextRequest) {
  try {
    const { groupId, batchSize, stream } = parseSSERequest(request);
    
    if (!groupId) {
      return new Response('Group ID required', { status: 400 });
    }
    
    // Get patch info
    const patch = await prisma.patch.findUnique({
      where: { handle: groupId },
      select: { id: string, handle: string, name: string }
    });
    
    if (!patch) {
      return new Response('Patch not found', { status: 404 });
    }
    
    // Check Redis health
    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      console.warn('[Discovery] Redis not available, using fallback mode');
    }
    
    // Create SSE response
    return createSSEResponse(async (sse: DiscoverySSE) => {
      console.log(`[Discovery] Starting SSE stream for patch ${patch.handle}`);
      
      try {
        // Initialize discovery loop
        const discoveryLoop = new DiscoveryLoop({
          groupId: patch.id,
          patchHandle: patch.handle,
          maxIterations: batchSize,
          timeBudgetMs: 3000,
          jitterMs: 500
        });
        
        // Send initial state
        sse.sendState('searching');
        sse.sendFound(0);
        sse.sendProgress(0, batchSize);
        
        // Start discovery loop
        await discoveryLoop.start();
        
        // Monitor progress
        const progressInterval = setInterval(() => {
          const state = discoveryLoop.getState();
          sse.sendProgress(state.totalFound, batchSize);
          
          if (state.totalFound > 0) {
            sse.sendState('processing');
          }
          
          if (!state.isRunning) {
            clearInterval(progressInterval);
            sse.sendComplete(state.totalFound);
          }
        }, 1000);
        
        // Cleanup on close
        const cleanup = () => {
          clearInterval(progressInterval);
          discoveryLoop.stop();
        };
        
        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
        
      } catch (error) {
        console.error('[Discovery] Stream error:', error);
        sse.sendError(error instanceof Error ? error.message : String(error));
        sse.close();
      }
    });
    
  } catch (error) {
    console.error('[Discovery] Route error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST /api/patches/[handle]/discovery/stream
 * 
 * Start discovery process
 */
export async function POST(request: NextRequest) {
  try {
    const { groupId } = parseSSERequest(request);
    
    if (!groupId) {
      return new Response('Group ID required', { status: 400 });
    }
    
    // Get patch info
    const patch = await prisma.patch.findUnique({
      where: { handle: groupId },
      select: { id: string, handle: string, name: string }
    });
    
    if (!patch) {
      return new Response('Patch not found', { status: 404 });
    }
    
    // Initialize frontier
    const frontier = new SearchFrontier(patch.id);
    await frontier.initializeFrontier(patch.handle);
    
    // Get frontier stats
    const stats = await frontier.getFrontierStats();
    
    return Response.json({
      success: true,
      message: 'Discovery started',
      stats
    });
    
  } catch (error) {
    console.error('[Discovery] POST error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}