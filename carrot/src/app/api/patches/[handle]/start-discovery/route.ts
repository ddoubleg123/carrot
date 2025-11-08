import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { BatchedLogger } from '@/lib/discovery/logger';
import { BullsDiscoveryOrchestrator } from '@/lib/discovery/bullsDiscoveryOrchestrator';
import { OneAtATimeWorker } from '@/lib/discovery/oneAtATimeWorker';
import { getGroupProfile } from '@/lib/discovery/groupProfiles';
import { isOpenEvidenceV2Enabled } from '@/lib/discovery/flags';
import { runOpenEvidenceEngine } from '@/lib/discovery/engine';

export const runtime = 'nodejs';

// GET handler for SSE streaming (EventSource compatibility)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  console.log('[Start Discovery] GET endpoint called (SSE streaming)');
  
  // GET is always streaming
  const url = new URL(request.url);
  const modifiedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ action: 'start_deepseek_search' })
  });
  
  // Reuse POST logic
  return POST(modifiedRequest, { params });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  console.log('[Start Discovery] POST endpoint called');
  const openEvidenceEnabled = isOpenEvidenceV2Enabled();
  console.log('[Start Discovery] Feature flag OPEN_EVIDENCE_V2:', openEvidenceEnabled ? 'enabled' : 'disabled');
  
  // Check if SSE streaming is requested
  const url = new URL(request.url)
  const isStreaming = url.searchParams.get('stream') === 'true' || request.method === 'GET'
  
  try {
    const session = await auth();
    console.log('[Start Discovery] Session check:', session ? 'Found' : 'Not found');
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle } = await params;
    const body = await request.json().catch(() => ({ action: 'start_deepseek_search' }));
    const { action } = body;

    if (action !== 'start_deepseek_search') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the patch to access its tags and description
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        createdBy: true
      }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Check if user has permission to start discovery
    const isOwner = patch.createdBy === session.user.id;
    const isMember = await prisma.patchMember.findUnique({
      where: {
        patch_user_member_unique: {
          patchId: patch.id,
          userId: session.user.id
        }
      }
    });

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if DeepSeek API key is configured
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Start Discovery] DEEPSEEK_API_KEY not configured', {
        patchId: patch.id,
        handle,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Discovery service not configured. Please set DEEPSEEK_API_KEY environment variable.',
        code: 'MISSING_API_KEY',
        patchId: patch.id
      }, { status: 500 });
    }

    if (openEvidenceEnabled) {
      const run = await (prisma as any).discoveryRun.create({
        data: {
          patchId: patch.id,
          status: 'queued'
        }
      })

      runOpenEvidenceEngine({
        patchId: patch.id,
        patchHandle: handle,
        patchName: patch.name,
        runId: run.id
      }).catch(async (error) => {
        console.error('[Start Discovery] Open Evidence engine failed', error)
        await (prisma as any).discoveryRun.update({
          where: { id: run.id },
          data: {
            status: 'error',
            metrics: {
              error: error instanceof Error ? error.message : String(error)
            }
          }
        }).catch(() => undefined)
      })

      return NextResponse.json({
        status: 'live',
        runId: run.id
      })
    }

    // Check if this is Chicago Bulls group
    const groupProfile = getGroupProfile('chicago-bulls')
    if (!groupProfile) {
      return NextResponse.json({ 
        error: 'Group profile not found',
        code: 'GROUP_PROFILE_NOT_FOUND',
        patchId: patch.id
      }, { status: 400 });
    }
    
    console.log('[Start Discovery] Starting Bulls-specific discovery for patch:', {
      patchId: patch.id,
      handle,
      name: patch.name,
      tags: patch.tags,
      description: patch.description
    });
    
    // 🚀 OPTIMIZATION: Build URL cache of ALL processed URLs (approved + denied)
    const processedUrls = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: { 
        sourceUrl: true, 
        canonicalUrl: true,
        title: true,
        status: true 
      }
    });
    
    // Create URL cache for fast lookups
    const urlCache = new Set<string>();
    processedUrls.forEach(item => {
      if (item.sourceUrl) urlCache.add(item.sourceUrl);
      if (item.canonicalUrl) urlCache.add(item.canonicalUrl);
    });
    
    console.log('[Start Discovery] 🗄️ URL Cache built:', {
      totalProcessed: processedUrls.length,
      approved: processedUrls.filter(p => p.status === 'ready').length,
      denied: processedUrls.filter(p => p.status === 'denied' || p.status === 'rejected').length,
      cacheSize: urlCache.size
    });
    
    // Execute Bulls-Specific Discovery
    console.log('[Start Discovery] Initializing Bulls Discovery Orchestrator...')
    const orchestrator = new BullsDiscoveryOrchestrator()
    
    let discoveryResult
    try {
      discoveryResult = await orchestrator.discover(
        patch.name,
        patch.description || '',
        patch.tags
      )
      
      console.log('[Start Discovery] ✅ Bulls discovery complete:', {
        totalSources: discoveryResult.sources.length,
        wikipediaPages: discoveryResult.stats.wikipediaPages,
        wikipediaCitations: discoveryResult.stats.wikipediaCitations,
        duplicatesRemoved: discoveryResult.stats.duplicatesRemoved,
        relevanceFiltered: discoveryResult.stats.relevanceFiltered
      })
    } catch (error: any) {
      console.error('[Start Discovery] Bulls orchestrator error:', error)
      return NextResponse.json({ 
        error: 'Failed to discover content',
        code: 'ORCHESTRATOR_ERROR',
        message: error.message,
        patchId: patch.id
      }, { status: 500 });
    }
    
    // Convert DiscoveredSource format for one-at-a-time processing
    const discoveredSources = discoveryResult.sources

    // If streaming, create SSE stream
    if (isStreaming) {
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()
      const encoder = new TextEncoder()
      
      const sendEvent = (event: string, data: any) => {
        writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      
      // Process in background using one-at-a-time worker
      ;(async () => {
        try {
          sendEvent('state', { phase: 'wikipedia' })
          sendEvent('wikipedia:start', { count: discoveredSources.length })
          
          // Initialize one-at-a-time worker
          const worker = new OneAtATimeWorker()
          
          // Process sources one at a time
          const result = await worker.processSources(
            discoveredSources,
            patch.id,
            handle,
            sendEvent
          )
          
          console.log(`[Start Discovery] One-at-a-time processing complete:`, {
            saved: result.saved,
            rejected: result.rejected,
            duplicates: result.duplicates
          })
          
          // Send complete event
          sendEvent('complete', { 
            done: result.saved, 
            rejected: result.rejected,
            duplicates: result.duplicates
          })
          sendEvent('state', { phase: 'completed' })
          
        } catch (error) {
          console.error('[Start Discovery] Stream error:', error)
          sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' })
          sendEvent('state', { phase: 'error' })
        } finally {
          writer.close()
        }
      })()
      
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }
    
    // Non-streaming fallback using one-at-a-time worker
    const worker = new OneAtATimeWorker()
    
    try {
      const result = await worker.processSources(
        discoveredSources,
        patch.id,
        handle,
        (event, data) => console.log(`[Start Discovery] ${event}:`, data)
      )
      
      console.log('[Start Discovery] Non-streaming summary:', {
        discovered: discoveredSources.length,
        saved: result.saved,
        rejected: result.rejected,
        duplicates: result.duplicates
      });

      return NextResponse.json({
        success: true,
        message: `Started content discovery for "${patch.name}"`,
        itemsDiscovered: discoveredSources.length,
        itemsSaved: result.saved,
        itemsRejected: result.rejected,
        itemsDuplicate: result.duplicates,
        items: [], // Will be populated by SSE in streaming mode
        rejections: []
      });
    } catch (error) {
      console.error('[Start Discovery] Non-streaming error:', error)
      return NextResponse.json({
        success: false,
        error: 'Discovery failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Start Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
