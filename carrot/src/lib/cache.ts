// Simple in-memory cache for frequently accessed data
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Maximum number of entries

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize
    };
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  posts: (limit?: number) => `posts:${limit || 'all'}`,
  patch: (handle: string) => `patch:${handle}`,
  user: (id: string) => `user:${id}`,
  patchFollowers: (patchId: string) => `patch:${patchId}:followers`,
  patchEvents: (patchId: string) => `patch:${patchId}:events`,
} as const;

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  posts: 2 * 60 * 1000, // 2 minutes
  patch: 5 * 60 * 1000, // 5 minutes
  user: 10 * 60 * 1000, // 10 minutes
  patchFollowers: 5 * 60 * 1000, // 5 minutes
  patchEvents: 5 * 60 * 1000, // 5 minutes
} as const;
