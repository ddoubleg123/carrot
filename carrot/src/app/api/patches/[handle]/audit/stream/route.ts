import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { subscribeAuditEvents } from '@/lib/discovery/eventBus'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return new Response('Patch not found', { status: 404 })
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const unsubscribe = subscribeAuditEvents(patch.id, (event) => {
          const payload = `data: ${JSON.stringify(event)}\n\n`
          try {
            controller.enqueue(encoder.encode(payload))
          } catch (error) {
            console.error('[Audit Stream] Failed to enqueue SSE payload', error)
          }
        })

        request.signal.addEventListener('abort', () => {
          unsubscribe()
          try {
            controller.close()
          } catch {
            // ignore
          }
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
    console.error('[Audit Stream] Failed to open SSE stream', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
