/**
 * Feature flags configuration
 * New flags default to false and are flipped per-patch in PATCH_FEATURES
 */

export interface PatchFeatures {
  enableWikipediaExpansion: boolean
  enablePrintBranches: boolean
  enableAmpBranches: boolean
  enableRecrawl: boolean
  // Pipeline features
  enableStaticSeeds: boolean
  enableRenderBranch: boolean
  enableNewApiShape: boolean
  enableHeroThreshold: boolean
}

/**
 * Default feature flags (all OFF for safety)
 * For chicago-bulls, pipeline features default ON
 */
export function getDefaultFeatures(patchHandle?: string): PatchFeatures {
  const isBulls = patchHandle === 'chicago-bulls'
  return {
    enableWikipediaExpansion: false,
    enablePrintBranches: false,
    enableAmpBranches: false,
    enableRecrawl: false,
    // Pipeline features - ON for Bulls, OFF otherwise
    enableStaticSeeds: isBulls,
    enableRenderBranch: isBulls,
    enableNewApiShape: isBulls,
    enableHeroThreshold: isBulls
  }
}

/**
 * Parse PATCH_FEATURES env var (comma-separated list)
 * Example: PATCH_FEATURES=wikipedia,recrawl,static_seeds,render
 */
function parsePatchFeatures(patchHandle?: string): PatchFeatures {
  const features = getDefaultFeatures(patchHandle)
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
  if (enabled.includes('static_seeds') || enabled.includes('static')) {
    features.enableStaticSeeds = true
  }
  if (enabled.includes('render') || enabled.includes('render_branch')) {
    features.enableRenderBranch = true
  }
  if (enabled.includes('new_api') || enabled.includes('api_shape')) {
    features.enableNewApiShape = true
  }
  if (enabled.includes('hero_threshold') || enabled.includes('hero')) {
    features.enableHeroThreshold = true
  }
  
  return features
}

/**
 * Get current feature flags for a patch
 */
export function getPatchFeatures(patchHandle?: string): PatchFeatures {
  return parsePatchFeatures(patchHandle)
}

