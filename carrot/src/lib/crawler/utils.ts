/**
 * Crawler utilities for URL hashing, content deduplication, and priority scoring
 * Phase 1: Foundation
 */

import { createHash } from 'crypto'
import { canonicalizeUrlFast } from '../discovery/canonicalize'

/**
 * Create SHA-256 hash of a normalized URL for Redis seen-set
 */
export function hashUrl(url: string): string {
  const normalized = canonicalizeUrlFast(url) || url
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Create SHA-256 hash of cleaned text content for near-duplicate detection
 */
export function hashText(text: string): string {
  // Clean text: lowercase, remove extra whitespace, normalize unicode
  const cleaned = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
  
  return createHash('sha256').update(cleaned).digest('hex')
}

/**
 * Check if URL matches article-like patterns
 * Returns true if URL contains date slugs or article paths
 */
export function isArticleLikeUrl(url: string): boolean {
  const articleRegex = /\d{4}\/\d{2}\/|\/\d{4}\/|\/news\/|\/article\/|\/story\/|\/sports\//
  return articleRegex.test(url)
}

/**
 * Calculate path depth bonus for priority scoring
 * Deeper paths (more segments) get higher priority
 */
export function getPathDepth(url: string): number {
  try {
    const urlObj = new URL(url)
    const segments = urlObj.pathname.split('/').filter(Boolean)
    return segments.length
  } catch {
    return 0
  }
}

/**
 * Extract domain from URL (normalized, no www)
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

