/**
 * Feature flags configuration
 * New flags default to false and are flipped per-patch in PATCH_FEATURES
 */

export interface PatchFeatures {
  enableWikipediaExpansion: boolean
  enablePrintBranches: boolean
  enableAmpBranches: boolean
  enableRecrawl: boolean
}

/**
 * Default feature flags (all OFF for safety)
 */
export const DEFAULT_FEATURES: PatchFeatures = {
  enableWikipediaExpansion: false,
  enablePrintBranches: false,
  enableAmpBranches: false,
  enableRecrawl: false
}

/**
 * Parse PATCH_FEATURES env var (comma-separated list)
 * Example: PATCH_FEATURES=wikipedia,recrawl
 */
function parsePatchFeatures(): PatchFeatures {
  const features = { ...DEFAULT_FEATURES }
  const envValue = process.env.PATCH_FEATURES
  
  if (!envValue) {
    return features
  }
  
  const enabled = envValue.split(',').map(f => f.trim().toLowerCase())
  
  if (enabled.includes('wikipedia') || enabled.includes('wikipedia_expansion')) {
    features.enableWikipediaExpansion = true
  }
  if (enabled.includes('print') || enabled.includes('print_branches')) {
    features.enablePrintBranches = true
  }
  if (enabled.includes('amp') || enabled.includes('amp_branches')) {
    features.enableAmpBranches = true
  }
  if (enabled.includes('recrawl')) {
    features.enableRecrawl = true
  }
  
  return features
}

/**
 * Get current feature flags
 */
export function getPatchFeatures(): PatchFeatures {
  return parsePatchFeatures()
}

