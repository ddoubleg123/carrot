/**
 * Multi-Tier Deduplication System
 * 
 * Implements three tiers of deduplication:
 * - Tier A: Fast URL-based checks (Redis + DB)
 * - Tier B: Content hash comparison (SimHash)
 * - Tier C: Title/entity similarity (cosine similarity)
 */

import { PrismaClient } from '@prisma/client';
import { DiscoveryRedis } from './redis';
import { generateSimHash, isNearDuplicate, generateContentFingerprint } from './simhash';
import { canonicalize } from './canonicalization';

const prisma = new PrismaClient();

export interface DeduplicationResult {
  isDuplicate: boolean;
  tier: 'A' | 'B' | 'C' | null;
  reason?: string;
  confidence: number;
}

export interface DeduplicationOptions {
  groupId: string;
  url: string;
  title: string;
  content?: string;
  description?: string;
  domain?: string;
}

/**
 * Multi-tier deduplication check
 */
export async function checkDeduplication(options: DeduplicationOptions): Promise<DeduplicationResult> {
  const { groupId, url, title, content, description, domain } = options;
  
  try {
    // Canonicalize URL first
    const canonicalResult = await canonicalize(url);
    const canonicalUrl = canonicalResult.canonicalUrl;
    
    // Tier A: Fast URL-based deduplication
    const tierAResult = await checkTierA(groupId, canonicalUrl);
    if (tierAResult.isDuplicate) {
      return {
        isDuplicate: true,
        tier: 'A',
        reason: 'URL already seen',
        confidence: 1.0
      };
    }
    
    // Tier B: Content hash deduplication
    const contentHash = generateContentFingerprint({ title, content, description });
    const tierBResult = await checkTierB(groupId, contentHash);
    if (tierBResult.isDuplicate) {
      return {
        isDuplicate: true,
        tier: 'B',
        reason: 'Content hash near-duplicate',
        confidence: tierBResult.confidence
      };
    }
    
    // Tier C: Title/entity similarity
    const tierCResult = await checkTierC(groupId, title, domain);
    if (tierCResult.isDuplicate) {
      return {
        isDuplicate: true,
        tier: 'C',
        reason: 'Title/entity similarity',
        confidence: tierCResult.confidence
      };
    }
    
    // Not a duplicate
    return {
      isDuplicate: false,
      tier: null,
      confidence: 0.0
    };
    
  } catch (error) {
    console.error('[Deduplication] Error checking deduplication:', error);
    // On error, allow the item through (fail open)
    return {
      isDuplicate: false,
      tier: null,
      confidence: 0.0
    };
  }
}

/**
 * Tier A: Fast URL-based deduplication
 */
async function checkTierA(groupId: string, canonicalUrl: string): Promise<{ isDuplicate: boolean }> {
  // Check Redis cache first
  const isSeenInRedis = await DiscoveryRedis.isUrlSeen(groupId, canonicalUrl);
  if (isSeenInRedis) {
    return { isDuplicate: true };
  }
  
  // Check database
  const existing = await prisma.discoveredContent.findFirst({
    where: {
      patchId: groupId,
      canonicalUrl: canonicalUrl
    },
    select: { id: true }
  });
  
  if (existing) {
    // Add to Redis cache for future checks
    await DiscoveryRedis.markUrlSeen(groupId, canonicalUrl);
    return { isDuplicate: true };
  }
  
  return { isDuplicate: false };
}

/**
 * Tier B: Content hash deduplication
 */
async function checkTierB(groupId: string, contentHash: string): Promise<{ isDuplicate: boolean; confidence: number }> {
  // Get recent content hashes from Redis
  const recentHashes = await DiscoveryRedis.getContentHashes(groupId, 1000);
  
  // Check for near-duplicates
  const isNearDup = await DiscoveryRedis.isNearDuplicate(groupId, contentHash, 3);
  
  if (isNearDup) {
    return {
      isDuplicate: true,
      confidence: 0.9
    };
  }
  
  // Also check database for older hashes
  const dbHashes = await prisma.discoveredContent.findMany({
    where: {
      patchId: groupId,
      contentHash: { not: null }
    },
    select: { contentHash: true },
    take: 100,
    orderBy: { createdAt: 'desc' }
  });
  
  for (const item of dbHashes) {
    if (item.contentHash && isNearDuplicate(contentHash, item.contentHash, 3)) {
      return {
        isDuplicate: true,
        confidence: 0.8
      };
    }
  }
  
  return { isDuplicate: false, confidence: 0.0 };
}

/**
 * Tier C: Title/entity similarity
 */
async function checkTierC(groupId: string, title: string, domain?: string): Promise<{ isDuplicate: boolean; confidence: number }> {
  // Get recent items from same domain
  const recentItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: groupId,
      domain: domain,
      createdAt: {
        gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // Last 14 days
      }
    },
    select: { title: true, createdAt: true },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });
  
  for (const item of recentItems) {
    const similarity = calculateCosineSimilarity(title, item.title);
    
    if (similarity > 0.92) {
      return {
        isDuplicate: true,
        confidence: similarity
      };
    }
  }
  
  return { isDuplicate: false, confidence: 0.0 };
}

/**
 * Calculate cosine similarity between two strings
 */
function calculateCosineSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const allWords = new Set([...words1, ...words2]);
  const vector1 = Array.from(allWords).map(word => words1.filter(w => w === word).length);
  const vector2 = Array.from(allWords).map(word => words2.filter(w => w === word).length);
  
  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Mark content as processed (add to caches)
 */
export async function markContentProcessed(
  groupId: string, 
  canonicalUrl: string, 
  contentHash: string,
  domain?: string
): Promise<void> {
  try {
    // Add to seen URLs cache
    await DiscoveryRedis.markUrlSeen(groupId, canonicalUrl);
    
    // Add to content hashes cache
    await DiscoveryRedis.addContentHash(groupId, contentHash);
    
    console.log(`[Deduplication] Marked content as processed: ${canonicalUrl}`);
  } catch (error) {
    console.error('[Deduplication] Error marking content as processed:', error);
  }
}

/**
 * Get deduplication statistics
 */
export async function getDeduplicationStats(groupId: string): Promise<{
  totalSeen: number;
  totalHashes: number;
  duplicateRate: number;
}> {
  try {
    const seenCount = await DiscoveryRedis.redis.scard(DiscoveryRedis.REDIS_KEYS.seenUrls(groupId));
    const hashCount = await DiscoveryRedis.redis.zcard(DiscoveryRedis.REDIS_KEYS.contentHashes(groupId));
    
    // Calculate duplicate rate from recent activity
    const recentItems = await prisma.discoveredContent.count({
      where: {
        patchId: groupId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    
    const duplicateRate = recentItems > 0 ? (seenCount / recentItems) : 0;
    
    return {
      totalSeen: seenCount,
      totalHashes: hashCount,
      duplicateRate: Math.min(duplicateRate, 1.0)
    };
  } catch (error) {
    console.error('[Deduplication] Error getting stats:', error);
    return {
      totalSeen: 0,
      totalHashes: 0,
      duplicateRate: 0
    };
  }
}
