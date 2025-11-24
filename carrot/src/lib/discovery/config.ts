/**
 * Discovery system configuration
 * Feature flags and settings with safe defaults
 */

export const DISCOVERY_CONFIG = {
  // Renderer settings
  RENDERER_ENABLED: process.env.RENDERER_ENABLED === 'true' || process.env.RENDERER_ENABLED !== 'false', // Default: true
  RENDERER_CONCURRENCY: Number(process.env.DISCOVERY_RENDER_CONCURRENCY || '3'),
  
  // Seed planner settings
  MIN_UNIQUE_DOMAINS: Number(process.env.DISCOVERY_MIN_UNIQUE_DOMAINS || '5'),
  MIN_UNIQUE_DOMAINS_WARN: 8, // Warn below this threshold
  
  // Fetch settings
  FETCH_TIMEOUT_MS: 12000, // Navigation timeout
  CONTENT_WAIT_MS: 8000, // Content wait timeout
  
  // Extraction settings
  MIN_TEXT_BYTES: 400, // Minimum text bytes for full content
  MIN_TEXT_BYTES_PARTIAL: 100, // Minimum for partial content
  
  // Hero creation settings
  HERO_BATCH_SIZE: 50,
  HERO_CONCURRENCY: 5,
  
  // Fallback seed domains for Chicago Bulls (and similar sports topics)
  FALLBACK_SEED_DOMAINS: [
    'espn.com',
    'nba.com',
    'theathletic.com',
    'cbssports.com',
    'yahoo.com',
    'bleacherreport.com',
    'apnews.com',
    'reddit.com',
    'wikipedia.org'
  ]
} as const

/**
 * Get renderer enabled status
 */
export function isRendererEnabled(): boolean {
  return DISCOVERY_CONFIG.RENDERER_ENABLED
}

/**
 * Get minimum unique domains (with warning threshold)
 */
export function getMinUniqueDomains(): { min: number; warn: number } {
  return {
    min: DISCOVERY_CONFIG.MIN_UNIQUE_DOMAINS,
    warn: DISCOVERY_CONFIG.MIN_UNIQUE_DOMAINS_WARN
  }
}

