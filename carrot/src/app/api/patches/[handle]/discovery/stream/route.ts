/**
 * SSE streaming endpoint for discovery events
 */

import { createDiscoveryStream } from '@/lib/discovery/streaming'
import { DiscoveryOrchestrator } from '@/lib/discovery/orchestrator'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  
  return createDiscoveryStream({
    groupId: handle,
    maxItems: 10,
    timeout: 300000, // 5 minutes
    onEvent: (event) => {
      console.log('[DiscoveryStream] Event:', event.type, event.data)
    }
  })
}
