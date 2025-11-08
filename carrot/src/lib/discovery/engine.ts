import { DiscoveryOrchestrator } from './orchestrator'
import { DiscoveryEventStream, type DiscoveryEvent } from './streaming'
import { publishDiscoveryEvent } from './eventBus'
import { clearActiveRun, setActiveRun } from '@/lib/redis/discovery'

const activeRuns = new Map<string, { orchestrator: DiscoveryOrchestrator; eventStream: DiscoveryEventStream; patchId: string }>()

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

  activeRuns.set(runId, { orchestrator, eventStream, patchId })
  await setActiveRun(patchId, runId).catch((error) => {
    console.warn('[OpenEvidenceEngine] Failed to record active run in Redis', error)
  })

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
  } finally {
    activeRuns.delete(runId)
    await clearActiveRun(patchId).catch((error) => {
      console.warn('[OpenEvidenceEngine] Failed to clear active run in Redis', error)
    })
  }
}

export function stopOpenEvidenceRun(runId: string): boolean {
  const active = activeRuns.get(runId)
  if (!active) {
    return false
  }

  active.orchestrator.requestStop()
  return true
}

