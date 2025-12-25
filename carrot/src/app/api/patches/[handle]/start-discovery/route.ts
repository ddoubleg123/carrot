import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
// Removed BullsDiscoveryOrchestrator - all discovery now uses generic engine
// Removed OneAtATimeWorker - all discovery now uses generic engine
import { getGroupProfile } from '@/lib/discovery/groupProfiles';
import {
  isDiscoveryV21Enabled,
  isDiscoveryV2Enabled,
  isOpenEvidenceV2Enabled,
  isDiscoveryKillSwitchEnabled,
  isPatchForceStopped
} from '@/lib/discovery/flags';
import { runOpenEvidenceEngine } from '@/lib/discovery/engine';
import { clearFrontier, storeDiscoveryPlan } from '@/lib/redis/discovery';
import { generateGuideSnapshot, seedFrontierFromPlan, type DiscoveryPlan } from '@/lib/discovery/planner';

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
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  console.log(`[Start Discovery] POST endpoint called [${requestId}]`, {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })
  
  const openEvidenceEnabled = isOpenEvidenceV2Enabled();
  const discoveryV21Enabled = isDiscoveryV21Enabled();
  const discoveryV2Enabled = isDiscoveryV2Enabled();
  console.log(`[Start Discovery] [${requestId}] Feature flags:`, {
    OPEN_EVIDENCE_V2: openEvidenceEnabled,
    DISCOVERY_V21: discoveryV21Enabled,
    DISCOVERY_V2: discoveryV2Enabled
  })
  
  if (isDiscoveryKillSwitchEnabled()) {
    return NextResponse.json(
      { error: 'Discovery is currently disabled via killswitch.' },
      { status: 503 }
    );
  }

  // Check if SSE streaming is requested
  const url = new URL(request.url)
  const isStreaming = url.searchParams.get('stream') === 'true' || request.method === 'GET'
  
  try {
    console.log(`[Start Discovery] [${requestId}] Starting auth check...`)
    const session = await auth();
    console.log(`[Start Discovery] [${requestId}] Session check:`, {
      hasSession: !!session,
      hasUserId: !!session?.user?.id,
      userId: session?.user?.id?.substring(0, 8) + '...'
    })
    
    if (!session?.user?.id) {
      console.warn(`[Start Discovery] [${requestId}] Unauthorized - no session or user ID`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Start Discovery] [${requestId}] Extracting params...`)
    const { handle } = await params;
    console.log(`[Start Discovery] [${requestId}] Patch handle:`, handle)
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
        title: true,
        description: true,
        tags: true,
        entity: true,
        createdBy: true,
        guide: true
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

    if (isPatchForceStopped(handle)) {
      return NextResponse.json({ error: 'Discovery paused for this patch' }, { status: 423 });
    }

    if (discoveryV21Enabled || discoveryV2Enabled) {
      const run = await (prisma as any).discoveryRun.create({
        data: {
          patchId: patch.id,
          status: 'queued'
        }
      })

      let guide = patch.guide as DiscoveryPlan | null
      if (!guide) {
        try {
          const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
          const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
          const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
            ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : patch.tags.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

          guide = await generateGuideSnapshot(topic, aliases)
          await prisma.patch.update({
            where: { id: patch.id },
            data: { guide: guide as unknown as Prisma.JsonObject }
          })
          console.log('[Start Discovery] Guide auto-generated for patch', { patchId: patch.id, topic })
        } catch (error) {
          console.error('[Start Discovery] Failed to auto-generate guide', { patchId: patch.id, error })
          return NextResponse.json({
            error: 'Discovery guide missing and automatic generation failed. Please refresh the guide and retry.'
          }, { status: 500 })
        }
      }

      if (isPatchForceStopped(patch.id)) {
        return NextResponse.json({ error: 'Discovery paused for this patch' }, { status: 423 });
      }

      await clearFrontier(patch.id).catch((error) => {
        console.warn('[Start Discovery] Failed to clear frontier before seeding', error)
      })

      await storeDiscoveryPlan(run.id, guide).catch((error) => {
        console.error('[Start Discovery] Failed to cache discovery plan', error)
        throw error
      })

      await seedFrontierFromPlan(patch.id, guide).catch((error) => {
        console.error('[Start Discovery] Failed to seed frontier from guide', error)
        throw error
      })

      await (prisma as any).discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'live',
          startedAt: new Date()
        }
      }).catch((error: unknown) => {
        console.warn('[Start Discovery] Failed to mark discovery run live', error)
      })

      console.log(`[Start Discovery] [${requestId}] Starting discovery engine v2.1...`, {
        patchId: patch.id,
        patchHandle: handle,
        runId: run.id
      })
      
      runOpenEvidenceEngine({
        patchId: patch.id,
        patchHandle: handle,
        patchName: patch.title,
        runId: run.id
      }).catch(async (error) => {
        console.error(`[Start Discovery] [${requestId}] Discovery v2.1 engine failed:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          patchId: patch.id,
          runId: run.id
        })
        await (prisma as any).discoveryRun.update({
          where: { id: run.id },
          data: {
            status: 'error',
            metrics: {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
            }
          }
        }).catch((updateError: unknown) => {
          console.error(`[Start Discovery] [${requestId}] Failed to update run status:`, updateError)
        })
      })
      
      console.log(`[Start Discovery] [${requestId}] Discovery engine started (async)`)

      return NextResponse.json({
        status: 'live',
        runId: run.id
      })
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
        patchName: patch.title,
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

      await (prisma as any).discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'live',
          startedAt: new Date()
        }
      }).catch((error: unknown) => {
        console.warn('[Start Discovery] Failed to mark legacy discovery run live', error)
      })

      return NextResponse.json({
        status: 'live',
        runId: run.id
      })
    }

    // All discovery now uses the generic DiscoveryEngineV21
    // No Bulls-specific logic - works for all patches

    // If streaming, create SSE stream
    if (isStreaming) {
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()
      const encoder = new TextEncoder()
      
      const sendEvent = (event: string, data: any) => {
        writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      
      // Legacy Bulls-specific worker removed - all discovery uses generic engine
      // This path should not be reached when DISCOVERY_V21 is enabled
      writer.close()
      
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }
    
    // All discovery now uses the generic DiscoveryEngineV21 (handled above)
    // Legacy Bulls-specific path removed - no longer needed
    // If we reach here, it means DISCOVERY_V21 is disabled, which should not happen
    return NextResponse.json({
      error: 'Discovery engine not available',
      code: 'ENGINE_NOT_AVAILABLE',
      message: 'Please enable DISCOVERY_V21 feature flag'
    }, { status: 500 })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Start Discovery] [${requestId}] FATAL ERROR:`, {
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 1000)
      } : String(error),
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { 
        error: message,
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
