/**
 * 3-tier deduplication system for discovery content
 * Tier A: URL-based (exact canonical URL)
 * Tier B: Content-based (SimHash with Hamming distance)
 * Tier C: Title/Domain similarity (cosine similarity)
 */

import { canonicalize } from './canonicalize'

export interface DeduplicationResult {
  isDuplicate: boolean
  tier: 'A' | 'B' | 'C' | null
  reason: string
  similarity?: number
  existingItem?: {
    id: string
    title: string
    url: string
  }
}

export interface ContentFingerprint {
  canonicalUrl: string
  simHash: bigint
  titleHash: string
  domain: string
  contentLength: number
}

/**
 * SimHash implementation for content fingerprinting
 */
export class SimHash {
  private static readonly HASH_BITS = 64
  
  /**
   * Generate SimHash for text content
   */
  static generate(text: string): bigint {
    const words = this.tokenize(text)
    const hash = new Array(this.HASH_BITS).fill(0)
    
    for (const word of words) {
      const wordHash = this.hash(word)
      for (let i = 0; i < this.HASH_BITS; i++) {
        if (wordHash & (BigInt(1) << BigInt(i))) {
          hash[i]++
        } else {
          hash[i]--
        }
      }
    }
    
    let result = BigInt(0)
    for (let i = 0; i < this.HASH_BITS; i++) {
      if (hash[i] > 0) {
        result |= (BigInt(1) << BigInt(i))
      }
    }
    
    return result
  }
  
  /**
   * Calculate Hamming distance between two SimHashes
   */
  static hammingDistance(hash1: bigint, hash2: bigint): number {
    const xor = hash1 ^ hash2
    let distance = 0
    let temp = xor
    
    while (temp > BigInt(0)) {
      distance += Number(temp & BigInt(1))
      temp >>= BigInt(1)
    }
    
    return distance
  }
  
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }
  
  private static hash(word: string): bigint {
    let hash = BigInt(0)
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << BigInt(5)) - hash + BigInt(word.charCodeAt(i))) & BigInt('0xffffffffffffffff')
    }
    return hash
  }
}

/**
 * Cosine similarity for title/domain matching
 */
export class CosineSimilarity {
  /**
   * Calculate cosine similarity between two text strings
   */
  static similarity(text1: string, text2: string): number {
    const vector1 = this.textToVector(text1)
    const vector2 = this.textToVector(text2)
    
    const dotProduct = this.dotProduct(vector1, vector2)
    const magnitude1 = this.magnitude(vector1)
    const magnitude2 = this.magnitude(vector2)
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0
    
    return dotProduct / (magnitude1 * magnitude2)
  }
  
  private static textToVector(text: string): Map<string, number> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || []
    const vector = new Map<string, number>()
    
    for (const word of words) {
      vector.set(word, (vector.get(word) || 0) + 1)
    }
    
    return vector
  }
  
  private static dotProduct(vector1: Map<string, number>, vector2: Map<string, number>): number {
    let sum = 0
    for (const [word, count1] of vector1) {
      const count2 = vector2.get(word) || 0
      sum += count1 * count2
    }
    return sum
  }
  
  private static magnitude(vector: Map<string, number>): number {
    let sum = 0
    for (const count of vector.values()) {
      sum += count * count
    }
    return Math.sqrt(sum)
  }
}

/**
 * Main deduplication checker
 */
export class DeduplicationChecker {
  private seenUrls = new Set<string>()
  private recentHashes = new Map<string, bigint[]>() // groupId -> recent hashes
  private recentTitles = new Map<string, Array<{title: string, domain: string, date: Date}>>()
  
  markAsSeen(
    groupId: string,
    canonicalUrl: string,
    content?: string,
    domain?: string,
    title?: string
  ): void {
    this.seenUrls.add(canonicalUrl)

    if (content) {
      const hash = SimHash.generate(content)
      const hashes = this.recentHashes.get(groupId) || []
      hashes.push(hash)
      if (hashes.length > 1000) {
        hashes.shift()
      }
      this.recentHashes.set(groupId, hashes)
    }

    if (title && domain) {
      const titles = this.recentTitles.get(groupId) || []
      titles.push({ title, domain, date: new Date() })
      if (titles.length > 100) {
        titles.shift()
      }
      this.recentTitles.set(groupId, titles)
    }
  }
  
  /**
   * Check if content is a duplicate using 3-tier system
   */
  async checkDuplicate(
    groupId: string,
    url: string,
    title: string,
    content: string,
    domain: string
  ): Promise<DeduplicationResult> {
    const canonical = await canonicalize(url)
    
    // Tier A: URL-based deduplication
    if (this.seenUrls.has(canonical.canonicalUrl)) {
      return {
        isDuplicate: true,
        tier: 'A',
        reason: 'Exact canonical URL already seen'
      }
    }
    
    // Tier B: Content-based deduplication (SimHash)
    const contentHash = SimHash.generate(content)
    const recentHashes = this.recentHashes.get(groupId) || []
    
    for (const existingHash of recentHashes) {
      const distance = SimHash.hammingDistance(contentHash, existingHash)
      if (distance <= 7) {
        return {
          isDuplicate: true,
          tier: 'B',
          reason: `Content similarity (Hamming distance: ${distance})`,
          similarity: 1 - (distance / 64)
        }
      }
    }
    
    // Tier C: Title/Domain similarity
    const recentTitles = this.recentTitles.get(groupId) || []
    const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days
    
    for (const recent of recentTitles) {
      if (recent.date < cutoffDate) continue
      
      if (recent.domain === domain) {
        const similarity = CosineSimilarity.similarity(title, recent.title)
        if (similarity > 0.92) {
          return {
            isDuplicate: true,
            tier: 'C',
            reason: `Title similarity on same domain (${(similarity * 100).toFixed(1)}%)`,
            similarity
          }
        }
      }
    }
    
    // Not a duplicate - add to tracking
    this.seenUrls.add(canonical.canonicalUrl)
    
    // Add to recent hashes (keep last 1000)
    if (!this.recentHashes.has(groupId)) {
      this.recentHashes.set(groupId, [])
    }
    const groupHashes = this.recentHashes.get(groupId)!
    groupHashes.push(contentHash)
    if (groupHashes.length > 1000) {
      groupHashes.shift()
    }
    
    // Add to recent titles (keep last 100)
    if (!this.recentTitles.has(groupId)) {
      this.recentTitles.set(groupId, [])
    }
    const groupTitles = this.recentTitles.get(groupId)!
    groupTitles.push({
      title,
      domain,
      date: new Date()
    })
    if (groupTitles.length > 100) {
      groupTitles.shift()
    }
    
    return {
      isDuplicate: false,
      tier: null,
      reason: 'Content is unique'
    }
  }
  
  /**
   * Generate content fingerprint for storage
   */
  async generateFingerprint(
    url: string,
    title: string,
    content: string
  ): Promise<ContentFingerprint> {
    const canonical = await canonicalize(url)
    const simHash = SimHash.generate(content)
    const titleHash = this.hashTitle(title)
    
    return {
      canonicalUrl: canonical.canonicalUrl,
      simHash,
      titleHash,
      domain: canonical.finalDomain,
      contentLength: content.length
    }
  }
  
  private hashTitle(title: string): string {
    // Simple hash for title storage
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      const char = title.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
  
  /**
   * Clear tracking data for a group (useful for testing)
   */
  clearGroup(groupId: string): void {
    this.recentHashes.delete(groupId)
    this.recentTitles.delete(groupId)
  }
  
  /**
   * Get statistics for a group
   */
  getStats(groupId: string): {
    urlCount: number
    hashCount: number
    titleCount: number
  } {
    return {
      urlCount: this.seenUrls.size,
      hashCount: this.recentHashes.get(groupId)?.length || 0,
      titleCount: this.recentTitles.get(groupId)?.length || 0
    }
  }
}


import { isSeen, markAsSeen, isNearDuplicate, markContentHash } from '@/lib/redis/discovery'

/**
 * Enhanced deduplication with Redis support
 * Uses Redis for persistent seen URLs and content hashes
 */
export class EnhancedDeduplicationChecker extends DeduplicationChecker {
  /**
   * Check duplicate using Redis (enhanced version)
   */
  async checkDuplicateRedis(
    patchId: string,
    canonicalUrl: string,
    contentHash: string
  ): Promise<{ isDuplicate: boolean, reason: string }> {
    // Tier A: Redis seen URLs
    if (await isSeen(patchId, canonicalUrl)) {
      return {
        isDuplicate: true,
        reason: 'URL already seen (Redis)'
      }
    }
    
    // Tier B: Redis near-duplicate check
    if (await isNearDuplicate(patchId, contentHash, 4)) {
      return {
        isDuplicate: true,
        reason: 'Near-duplicate content (SimHash)'
      }
    }
    
    return {
      isDuplicate: false,
      reason: 'Unique content'
    }
  }
  
  /**
   * Mark as seen and store hash in Redis
   */
  async markAsSeenRedis(patchId: string, canonicalUrl: string, contentHash: string): Promise<void> {
    await markAsSeen(patchId, canonicalUrl, 30)
    await markContentHash(patchId, contentHash)
  }
}

