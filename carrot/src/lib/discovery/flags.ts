import {
  OPEN_EVIDENCE_V2,
  DISCOVERY_V21,
  DISCOVERY_KILLSWITCH,
  DISCOVERY_V2,
  DISCOVERY_V2_GUARD_STRICT_SEEDS,
  DISCOVERY_V2_SHADOW_MODE,
  DISCOVERY_V2_WRITE_MODE,
  DISCOVERY_V2_FORCE_STOP_PATCHES
} from '../flags'

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

export function isDiscoveryV2Enabled(): boolean {
  return DISCOVERY_V2
}

export function isStrictSeedGuardEnabled(): boolean {
  return DISCOVERY_V2_GUARD_STRICT_SEEDS
}

export function isDiscoveryV2ShadowModeEnabled(): boolean {
  return DISCOVERY_V2_SHADOW_MODE
}

export function isDiscoveryV2WriteModeEnabled(): boolean {
  return DISCOVERY_V2_WRITE_MODE
}

export function isPatchForceStopped(identifier: string): boolean {
  if (!identifier) return false
  return DISCOVERY_V2_FORCE_STOP_PATCHES.has(identifier.toLowerCase())
}
