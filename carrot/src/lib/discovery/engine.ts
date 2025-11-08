import { DiscoveryOrchestrator } from './orchestrator'
import { DiscoveryEventStream, type DiscoveryEvent } from './streaming'
import { publishDiscoveryEvent } from './eventBus'

export interface OpenEvidenceEngineOptions {
  patchId: string
  patchHandle: string
  patchName: string
  runId: string
}

export async function runOpenEvidenceEngine({
  patchId,
  patchHandle,
  patchName,
  runId
}: OpenEvidenceEngineOptions): Promise<void> {
  const eventListener = (event: DiscoveryEvent) => {
    publishDiscoveryEvent(runId, event)
  }

  const eventStream = new DiscoveryEventStream(undefined, eventListener)
  const orchestrator = new DiscoveryOrchestrator(
    patchId,
    patchName,
    patchHandle,
    eventStream,
    runId
  )

  try {
    await orchestrator.start()
  } catch (error) {
    publishDiscoveryEvent(runId, {
      type: 'error',
      timestamp: Date.now(),
      data: { error: error instanceof Error ? error.message : String(error) },
      message: 'Discovery engine failed'
    })
    throw error
  }
}

