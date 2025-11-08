/**
 * SSE Stream endpoint for discovery events
 */

import { NextRequest } from 'next/server'
import { DiscoveryEventStream } from '@/lib/discovery/streaming'
import { DiscoveryOrchestrator } from '@/lib/discovery/orchestrator'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  
  try {
    // Find the patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, name: true }
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
        const eventStream = new DiscoveryEventStream(controller)
        
        // Start discovery orchestrator
        const orchestrator = new DiscoveryOrchestrator(
          patch.id,
          patch.name,
          handle,
          eventStream,
          run.id
        )
        
        // Start discovery in background
        orchestrator.start().catch(error => {
          console.error('[Discovery Stream] Error:', error)
          eventStream.error('Discovery failed', error)
        })
        
        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          eventStream.close()
        })
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
    
  } catch (error) {
    console.error('[Discovery Stream] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}