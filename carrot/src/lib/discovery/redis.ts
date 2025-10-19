/**
 * Redis Setup for Discovery System
 * 
 * Provides caching for:
 * - Seen URLs (Tier A deduplication)
 * - Content hashes (Tier B deduplication)
 * - Search frontier state
 */

import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

// Create Redis client
export const redis = new Redis(redisConfig);

// Redis key patterns
export const REDIS_KEYS = {
  // Tier A: Seen URLs cache
  seenUrls: (groupId: string) => `seen:group:${groupId}`,
  
  // Tier B: Content hashes for near-duplicate detection
  contentHashes: (groupId: string) => `hashes:group:${groupId}`,
  
  // Search frontier state
  frontier: (groupId: string) => `frontier:group:${groupId}`,
  
  // Provider rate limiting
  rateLimit: (provider: string) => `rate:${provider}`,
  
  // Discovery metrics
  metrics: (groupId: string) => `metrics:group:${groupId}`,
} as const;

/**
 * Redis operations for discovery system
 */
export class DiscoveryRedis {
  /**
   * Check if URL has been seen (Tier A deduplication)
   */
  static async isUrlSeen(groupId: string, canonicalUrl: string): Promise<boolean> {
    const key = REDIS_KEYS.seenUrls(groupId);
    return await redis.sismember(key, canonicalUrl) === 1;
  }
  
  /**
   * Mark URL as seen (Tier A deduplication)
   */
  static async markUrlSeen(groupId: string, canonicalUrl: string): Promise<void> {
    const key = REDIS_KEYS.seenUrls(groupId);
    await redis.sadd(key, canonicalUrl);
    // Set TTL to 30 days
    await redis.expire(key, 30 * 24 * 60 * 60);
  }
  
  /**
   * Get content hashes for near-duplicate detection (Tier B)
   */
  static async getContentHashes(groupId: string, limit: number = 1000): Promise<string[]> {
    const key = REDIS_KEYS.contentHashes(groupId);
    const hashes = await redis.zrevrange(key, 0, limit - 1);
    return hashes;
  }
  
  /**
   * Add content hash with timestamp (Tier B)
   */
  static async addContentHash(groupId: string, contentHash: string): Promise<void> {
    const key = REDIS_KEYS.contentHashes(groupId);
    const timestamp = Date.now();
    await redis.zadd(key, timestamp, contentHash);
    
    // Keep only last 1000 hashes
    await redis.zremrangebyrank(key, 0, -1001);
    
    // Set TTL to 30 days
    await redis.expire(key, 30 * 24 * 60 * 60);
  }
  
  /**
   * Check for near-duplicate content (Tier B)
   */
  static async isNearDuplicate(groupId: string, contentHash: string, threshold: number = 3): Promise<boolean> {
    const hashes = await this.getContentHashes(groupId, 1000);
    
    for (const existingHash of hashes) {
      const hammingDistance = this.calculateHammingDistance(contentHash, existingHash);
      if (hammingDistance <= threshold) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate Hamming distance between two hashes
   */
  private static calculateHammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return Infinity;
    
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }
  
  /**
   * Add search frontier candidate
   */
  static async addFrontierCandidate(groupId: string, candidate: any, priority: number): Promise<void> {
    const key = REDIS_KEYS.frontier(groupId);
    await redis.zadd(key, priority, JSON.stringify(candidate));
    
    // Set TTL to 7 days
    await redis.expire(key, 7 * 24 * 60 * 60);
  }
  
  /**
   * Get highest priority frontier candidate
   */
  static async getFrontierCandidate(groupId: string): Promise<any | null> {
    const key = REDIS_KEYS.frontier(groupId);
    const result = await redis.zrevrange(key, 0, 0);
    
    if (result.length === 0) return null;
    
    return JSON.parse(result[0]);
  }
  
  /**
   * Remove frontier candidate
   */
  static async removeFrontierCandidate(groupId: string, candidate: any): Promise<void> {
    const key = REDIS_KEYS.frontier(groupId);
    await redis.zrem(key, JSON.stringify(candidate));
  }
  
  /**
   * Update discovery metrics
   */
  static async updateMetrics(groupId: string, metrics: {
    timeToFirstNovel?: number;
    duplicatesPerMin?: number;
    novelRate?: number;
    itemsPerHour?: number;
    frontierDepth?: number;
    providerErrorRate?: number;
  }): Promise<void> {
    const key = REDIS_KEYS.metrics(groupId);
    const timestamp = Date.now();
    
    for (const [metric, value] of Object.entries(metrics)) {
      if (value !== undefined) {
        await redis.hset(key, `${metric}:${timestamp}`, value.toString());
      }
    }
    
    // Set TTL to 24 hours
    await redis.expire(key, 24 * 60 * 60);
  }
  
  /**
   * Get discovery metrics
   */
  static async getMetrics(groupId: string): Promise<Record<string, number[]>> {
    const key = REDIS_KEYS.metrics(groupId);
    const metrics = await redis.hgetall(key);
    
    const result: Record<string, number[]> = {};
    
    for (const [metricKey, value] of Object.entries(metrics)) {
      const [metric, timestamp] = metricKey.split(':');
      if (!result[metric]) result[metric] = [];
      result[metric].push(parseFloat(value));
    }
    
    return result;
  }
  
  /**
   * Check rate limit for provider
   */
  static async isRateLimited(provider: string, limit: number = 100, windowMs: number = 60000): Promise<boolean> {
    const key = REDIS_KEYS.rateLimit(provider);
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }
    
    return current > limit;
  }
  
  /**
   * Clear all discovery data for a group
   */
  static async clearGroupData(groupId: string): Promise<void> {
    const keys = [
      REDIS_KEYS.seenUrls(groupId),
      REDIS_KEYS.contentHashes(groupId),
      REDIS_KEYS.frontier(groupId),
      REDIS_KEYS.metrics(groupId),
    ];
    
    await redis.del(...keys);
  }
}

// Health check for Redis connection
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  await redis.quit();
}
