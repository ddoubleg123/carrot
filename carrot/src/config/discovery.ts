/**
 * Discovery System Configuration
 * 
 * Controls behavior of content discovery and hero image generation
 */

export const DISCOVERY_CONFIG = {
  // Maximum items to discover per run (per patch)
  MAX_ITEMS_PER_RUN: 15,
  
  // Enable automatic AI image generation during discovery
  ENABLE_AUTO_IMAGES: true,
  
  // Default artistic style for auto-generated images
  DEFAULT_IMAGE_STYLE: 'hyperrealistic',
  
  // Enable HD (High-Resolution Fix) by default
  HD_MODE: true,
  
  // Rate limiting: milliseconds between image generation calls
  RATE_LIMIT_MS: 10000, // 10 seconds
  
  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 5000,
  
  // Image quality thresholds
  MIN_IMAGE_WIDTH: 800,
  MIN_IMAGE_HEIGHT: 450,
  
  // Firebase storage paths
  STORAGE_PATHS: {
    DISCOVERED: 'discovered', // discovered/{itemId}/hero.png
    PATCHES: 'patches',       // patches/{patchHandle}/hero-{itemId}.png
    BACKFILL: 'backfill'      // backfill/{patchHandle}/{itemId}.png
  },
  
  // Fallback image sources (tried in order)
  FALLBACK_SOURCES: [
    'wikimedia',
    'og-image',
    'placeholder'
  ],
  
  // Feature flags
  FEATURES: {
    ENABLE_BACKFILL: true,
    ENABLE_AUTO_DISCOVERY: true,
    ENABLE_FALLBACKS: true,
    LOG_VERBOSE: true
  }
} as const;

export type DiscoveryConfig = typeof DISCOVERY_CONFIG;

