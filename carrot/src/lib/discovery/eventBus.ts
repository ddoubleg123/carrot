import { EventEmitter } from 'node:events'
import type { DiscoveryEvent } from './streaming'

const discoveryBus = new EventEmitter()
discoveryBus.setMaxListeners(0)

const auditBus = new EventEmitter()
auditBus.setMaxListeners(0)

export function publishDiscoveryEvent(runId: string, event: DiscoveryEvent) {
  discoveryBus.emit(runId, event)
}

export function subscribeDiscoveryEvents(
  runId: string,
  listener: (event: DiscoveryEvent) => void
): () => void {
  const wrapped = (event: DiscoveryEvent) => listener(event)
  discoveryBus.on(runId, wrapped)
  return () => {
    discoveryBus.off(runId, wrapped)
  }
}

export type AuditEvent = Record<string, any>

export function publishAuditEvent(patchId: string, event: AuditEvent) {
  auditBus.emit(patchId, event)
}

export function subscribeAuditEvents(
  patchId: string,
  listener: (event: AuditEvent) => void
): () => void {
  const wrapped = (event: AuditEvent) => listener(event)
  auditBus.on(patchId, wrapped)
  return () => {
    auditBus.off(patchId, wrapped)
  }
}

