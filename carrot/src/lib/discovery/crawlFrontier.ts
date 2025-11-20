import { prisma } from '@/lib/prisma'
import { canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'
import { createHash } from 'crypto'

export interface FrontierItem {
  url: string
  source?: string
  depth: number
  parentUrl?: string
  normalizedUrl: string
}

export interface FrontierStatus {
  status: 'pending' | 'success' | 'failed' | 'skipped'
  failReason?: string
  httpStatus?: number
  contentType?: string
  robotsAllowed?: boolean
  retryCount?: number
  title?: string
  sha256?: string
}

/**
 * Normalize URL for deduplication
 */
export function normalizeUrlForFrontier(url: string): string {
  try {
    const parsed = new URL(url)
    // Lowercase scheme and host
    const scheme = parsed.protocol.slice(0, -1).toLowerCase()
    const host = parsed.hostname.toLowerCase()
    
    // Remove fragments
    parsed.hash = ''
    
    // Sort query params
    const params = new URLSearchParams(parsed.search)
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    
    // Remove UTM params
    const cleanParams = new URLSearchParams(sortedParams)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => cleanParams.delete(k))
    
    // Rebuild URL
    const normalized = `${scheme}://${host}${parsed.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
    return normalized
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Check if URL is already in frontier with success status
 */
export async function isFrontierSuccess(normalizedUrl: string): Promise<boolean> {
  const existing = await prisma.crawlFrontier.findUnique({
    where: { normalizedUrl },
    select: { status: true }
  })
  return existing?.status === 'success'
}

/**
 * Add URL to frontier if not already present
 */
export async function addToFrontier(
  url: string,
  options: {
    source?: string
    depth?: number
    parentUrl?: string
  } = {}
): Promise<void> {
  const normalizedUrl = normalizeUrlForFrontier(url)
  
  // Check if already exists
  const existing = await prisma.crawlFrontier.findUnique({
    where: { normalizedUrl }
  })
  
  if (existing) {
    // Update if needed
    if (existing.status === 'pending' && options.depth !== undefined && options.depth < existing.depth) {
      await prisma.crawlFrontier.update({
        where: { normalizedUrl },
        data: {
          depth: options.depth,
          parentUrl: options.parentUrl,
          source: options.source || existing.source
        }
      })
    }
    return
  }
  
  // Insert new
  await prisma.crawlFrontier.create({
    data: {
      url,
      normalizedUrl,
      source: options.source || null,
      depth: options.depth ?? 0,
      parentUrl: options.parentUrl || null,
      status: 'pending'
    }
  })
}

/**
 * Get next pending URL from frontier (by priority: lowest depth, oldest lastTriedAt)
 */
export async function getNextPendingUrl(limit: number = 1): Promise<FrontierItem[]> {
  const items = await prisma.crawlFrontier.findMany({
    where: { status: 'pending' },
    orderBy: [
      { depth: 'asc' },
      { lastTriedAt: 'asc' },
      { firstSeenAt: 'asc' }
    ],
    take: limit
  })
  
  return items.map(item => ({
    url: item.url,
    source: item.source || undefined,
    depth: item.depth,
    parentUrl: item.parentUrl || undefined,
    normalizedUrl: item.normalizedUrl
  }))
}

/**
 * Update frontier status after processing
 */
export async function updateFrontierStatus(
  normalizedUrl: string,
  status: FrontierStatus
): Promise<void> {
  await prisma.crawlFrontier.update({
    where: { normalizedUrl },
    data: {
      status: status.status,
      failReason: status.failReason || null,
      httpStatus: status.httpStatus || null,
      contentType: status.contentType || null,
      robotsAllowed: status.robotsAllowed ?? null,
      retryCount: status.retryCount ?? 0,
      title: status.title || null,
      sha256: status.sha256 || null,
      lastTriedAt: new Date()
    }
  })
}

/**
 * Compute SHA256 hash of content for change detection
 */
export function computeContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Get frontier stats
 */
export async function getFrontierStats(): Promise<{
  pending: number
  success: number
  failed: number
  skipped: number
}> {
  const [pending, success, failed, skipped] = await Promise.all([
    prisma.crawlFrontier.count({ where: { status: 'pending' } }),
    prisma.crawlFrontier.count({ where: { status: 'success' } }),
    prisma.crawlFrontier.count({ where: { status: 'failed' } }),
    prisma.crawlFrontier.count({ where: { status: 'skipped' } })
  ])
  
  return { pending, success, failed, skipped }
}

