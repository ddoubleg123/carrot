/**
 * Centralised feature flag helpers.
 * Flags are evaluated at module load so they can be toggled via env vars.
 */

function parseFlag(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null) return defaultValue
  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    default:
      return false
  }
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export const OPEN_EVIDENCE_V2 = parseFlag(process.env.OPEN_EVIDENCE_V2)
export const DISCOVERY_V21 = parseFlag(process.env.DISCOVERY_V21, true)
export const DISCOVERY_KILLSWITCH = parseFlag(process.env.DISCOVERY_KILLSWITCH)

export const DISCOVERY_V2 = parseFlag(process.env.DISCOVERY_V2)
export const DISCOVERY_V2_GUARD_STRICT_SEEDS = parseFlag(process.env.DISCOVERY_V2_GUARD_STRICT_SEEDS)
export const DISCOVERY_V2_SHADOW_MODE = parseFlag(process.env.DISCOVERY_V2_SHADOW_MODE)
export const DISCOVERY_V2_WRITE_MODE = parseFlag(process.env.DISCOVERY_V2_WRITE_MODE)
export const DISCOVERY_V2_FORCE_STOP_PATCHES = new Set(
  parseCsv(process.env.DISCOVERY_V2_FORCE_STOP_PATCHES).map((entry) => entry.toLowerCase())
)

export function refreshFlags() {
  // Exposed for tests so they can reset process.env between cases.
  return {
    OPEN_EVIDENCE_V2: parseFlag(process.env.OPEN_EVIDENCE_V2),
    DISCOVERY_V21: parseFlag(process.env.DISCOVERY_V21, true),
    DISCOVERY_KILLSWITCH: parseFlag(process.env.DISCOVERY_KILLSWITCH),
    DISCOVERY_V2: parseFlag(process.env.DISCOVERY_V2),
    DISCOVERY_V2_GUARD_STRICT_SEEDS: parseFlag(process.env.DISCOVERY_V2_GUARD_STRICT_SEEDS),
    DISCOVERY_V2_SHADOW_MODE: parseFlag(process.env.DISCOVERY_V2_SHADOW_MODE),
    DISCOVERY_V2_WRITE_MODE: parseFlag(process.env.DISCOVERY_V2_WRITE_MODE),
    DISCOVERY_V2_FORCE_STOP_PATCHES: new Set(
      parseCsv(process.env.DISCOVERY_V2_FORCE_STOP_PATCHES).map((entry) => entry.toLowerCase())
    )
  }
}


