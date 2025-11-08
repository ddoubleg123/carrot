/**
 * Feature flag helpers for the Open Evidence Discovery rollout.
 *
 * Flags are evaluated on the server at runtime so changes can be rolled out
 * via environment variables without redeploys.
 */

function normalizeEnvFlag(value: string | undefined): boolean {
  if (!value) return false
  switch (value.toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    default:
      return false
  }
}

export function isOpenEvidenceV2Enabled(): boolean {
  return normalizeEnvFlag(process.env.OPEN_EVIDENCE_V2)
}

