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

export const OPEN_EVIDENCE_V2 = parseFlag(process.env.OPEN_EVIDENCE_V2)
export const DISCOVERY_V21 = parseFlag(process.env.DISCOVERY_V21, true)
export const DISCOVERY_KILLSWITCH = parseFlag(process.env.DISCOVERY_KILLSWITCH)

export function refreshFlags() {
  // Exposed for tests so they can reset process.env between cases.
  return {
    OPEN_EVIDENCE_V2: parseFlag(process.env.OPEN_EVIDENCE_V2),
    DISCOVERY_V21: parseFlag(process.env.DISCOVERY_V21, true),
    DISCOVERY_KILLSWITCH: parseFlag(process.env.DISCOVERY_KILLSWITCH)
  }
}

