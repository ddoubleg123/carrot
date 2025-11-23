/**
 * SSE Stream endpoint for discovery events
 */

import { NextRequest } from 'next/server'
import { DiscoveryEventStream } from '@/lib/discovery/streaming'
import { DiscoveryOrchestrator } from '@/lib/discovery/orchestrator'
import { prisma } from '@/lib/prisma'
import { isOpenEvidenceV2Enabled, isDiscoveryKillSwitchEnabled } from '@/lib/discovery/flags'
import { subscribeDiscoveryEvents } from '@/lib/discovery/eventBus'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const openEvidenceEnabled = isOpenEvidenceV2Enabled()

  if (isDiscoveryKillSwitchEnabled()) {
    return new Response('Discovery is disabled', { status: 503 })
  }
  
  try {
    if (openEvidenceEnabled) {
      const runId = request.nextUrl.searchParams.get('runId')
      if (!runId) {
        return new Response('runId query parameter is required', { status: 400 })
      }

      const run = await (prisma as any).discoveryRun.findUnique({
        where: { id: runId },
        select: { id: true, patchId: true }
      })

      if (!run) {
        return new Response('Discovery run not found', { status: 404 })
      }

      const patch = await prisma.patch.findUnique({
        where: { id: run.patchId },
        select: { id: true, handle: true }
      })

      if (!patch || patch.handle !== handle) {
        return new Response('Patch mismatch for discovery run', { status: 403 })
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          let isClosed = false
          
          // Heartbeat to keep connection alive
          const heartbeatInterval = setInterval(() => {
            if (isClosed) {
              clearInterval(heartbeatInterval)
              return
            }
            try {
              controller.enqueue(encoder.encode(':heartbeat\n\n'))
            } catch (error) {
              // Stream may be closed, ignore
              clearInterval(heartbeatInterval)
            }
          }, 10000) // Every 10 seconds
          
          const unsubscribe = subscribeDiscoveryEvents(runId, (event) => {
            if (isClosed) return
            const payload = `data: ${JSON.stringify(event)}\n\n`
            try {
              controller.enqueue(encoder.encode(payload))
            } catch (error) {
              // Stream closed, stop sending
              isClosed = true
              clearInterval(heartbeatInterval)
              unsubscribe()
            }
          })

          request.signal.addEventListener('abort', () => {
            isClosed = true
            clearInterval(heartbeatInterval)
            unsubscribe()
            try {
              controller.close()
            } catch {
              // ignore - already closed
            }
          })
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        }
      })
    }

    // Legacy behaviour when feature flag is disabled
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true }
    })
    
    if (!patch) {
      return new Response('Patch not found', { status: 404 })
    }
    
    // Create a discovery run record
    const run = await (prisma as any).discoveryRun.create({
      data: {
        patchId: patch.id,
        status: 'live'
      }
    })
    
    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let isClosed = false
        
        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (isClosed) {
            clearInterval(heartbeatInterval)
            return
          }
          try {
            controller.enqueue(encoder.encode(':heartbeat\n\n'))
          } catch (error) {
            // Stream may be closed, ignore
            clearInterval(heartbeatInterval)
          }
        }, 10000) // Every 10 seconds
        
        const eventStream = new DiscoveryEventStream(controller)
        
        // Start discovery orchestrator
        const orchestrator = new DiscoveryOrchestrator(
          patch.id,
          patch.title,
          handle,
          eventStream,
          run.id
        )
        
        // Start discovery in background
        orchestrator.start().catch(error => {
          console.error('[Discovery Stream] Error:', error)
          if (!isClosed) {
            eventStream.error('Discovery failed', error)
          }
        })
        
        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          isClosed = true
          clearInterval(heartbeatInterval)
          eventStream.close()
        })
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
    
  } catch (error) {
    console.error('[Discovery Stream] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}