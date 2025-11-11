export const SHADOW_SENTINEL = 'shadow::'

export interface PatchKeyParts {
  id: string
  shadow: boolean
}

export function resolvePatch(patchId: string): PatchKeyParts {
  if (patchId.startsWith(SHADOW_SENTINEL)) {
    return { id: patchId.slice(SHADOW_SENTINEL.length), shadow: true }
  }
  return { id: patchId, shadow: false }
}

