import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))
      
      // Poll for new audits (simplified - in production use Redis pub/sub)
      const interval = setInterval(async () => {
        try {
          if (runId) {
            const audits = await prisma.discoveryAudit.findMany({
              where: { runId },
              orderBy: { createdAt: 'desc' },
              take: 1
            })
            
            if (audits.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'audit', data: audits[0] })}\n\n`))
            }
          }
        } catch (error) {
          console.error('[Audit Stream] Error:', error)
        }
      }, 2000)
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
