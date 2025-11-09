import { OPEN_EVIDENCE_V2, DISCOVERY_V21, DISCOVERY_KILLSWITCH } from '../flags'

/**
 * Backwards compatible helpers while we transition call sites to the shared flags module.
 */
export function isOpenEvidenceV2Enabled(): boolean {
  return OPEN_EVIDENCE_V2
}

export function isDiscoveryV21Enabled(): boolean {
  return DISCOVERY_V21
}

export function isDiscoveryKillSwitchEnabled(): boolean {
  return DISCOVERY_KILLSWITCH
}
