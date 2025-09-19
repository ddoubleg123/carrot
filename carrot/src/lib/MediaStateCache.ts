export interface MediaState {
  postId: string;
  currentTime: number;
  isPaused: boolean;
  duration?: number;
  bufferedRanges: { start: number; end: number }[];
  posterLoaded: boolean;
  objectURL?: string;
  mediaSourceRef?: MediaSource;
  videoElement?: HTMLVideoElement;
  lastAccessed: number;
  estimatedSize: number; // bytes
  frozenFrame?: string; // base64 data URL
}

export interface CacheStats {
  totalEntries: number;
  totalSizeMB: number;
  maxSizeMB: number;
  hitRate: number;
  evictions: number;
}

// LRU Cache for media states with memory budget tracking
class MediaStateCache {
  private static _instance: MediaStateCache | null = null;
  
  static get instance(): MediaStateCache {
    if (!this._instance) {
      this._instance = new MediaStateCache();
    }
    return this._instance;
  }

  private cache = new Map<string, MediaState>();
  private accessOrder: string[] = []; // LRU tracking
  private totalSize = 0; // bytes
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  // Configuration
  private readonly MAX_SIZE_MB = 120; // 120MB budget
  private readonly MAX_ENTRIES = 50;
  private readonly POSTER_NEVER_EVICT = true; // Keep posters even when over budget

  // Size estimates (conservative)
  private readonly SIZE_ESTIMATES = {
    poster: 100 * 1024, // 100KB
    videoElement: 1024, // 1KB metadata
    frozenFrame: 200 * 1024, // 200KB JPEG
    bufferedData: 2 * 1024 * 1024, // 2MB per video with buffered content
    objectURL: 1024 // 1KB metadata
  };

  // Store media state
  set(postId: string, state: Partial<MediaState>): void {
    const existing = this.cache.get(postId);
    const now = Date.now();
    
    let newState: MediaState;
    if (existing) {
      // Update existing state
      newState = {
        ...existing,
        ...state,
        postId,
        lastAccessed: now
      };
    } else {
      // Create new state
      newState = {
        postId,
        currentTime: 0,
        isPaused: true,
        bufferedRanges: [],
        posterLoaded: false,
        lastAccessed: now,
        estimatedSize: 0,
        ...state
      };
    }

    // Calculate size
    newState.estimatedSize = this.calculateSize(newState);

    // Update cache
    this.cache.set(postId, newState);
    this.updateAccessOrder(postId);
    this.updateTotalSize();

    // Enforce budget limits
    this.enforceLimits();

    console.log('[MediaStateCache] Stored state', { 
      postId, 
      currentTime: newState.currentTime,
      isPaused: newState.isPaused,
      sizeMB: Math.round(newState.estimatedSize / 1024 / 1024 * 100) / 100
    });
  }

  // Get media state
  get(postId: string): MediaState | undefined {
    const state = this.cache.get(postId);
    if (state) {
      state.lastAccessed = Date.now();
      this.updateAccessOrder(postId);
      this.hits++;
      return state;
    } else {
      this.misses++;
      return undefined;
    }
  }

  // Check if state exists
  has(postId: string): boolean {
    return this.cache.has(postId);
  }

  // Remove state
  delete(postId: string): boolean {
    const state = this.cache.get(postId);
    if (state) {
      // Clean up object URLs to prevent memory leaks
      if (state.objectURL) {
        try {
          URL.revokeObjectURL(state.objectURL);
        } catch (e) {
          console.warn('[MediaStateCache] Failed to revoke object URL', e);
        }
      }
      
      this.cache.delete(postId);
      this.removeFromAccessOrder(postId);
      this.updateTotalSize();
      
      console.log('[MediaStateCache] Deleted state', { postId });
      return true;
    }
    return false;
  }

  // Update current time for a video
  updateTime(postId: string, currentTime: number): void {
    const state = this.cache.get(postId);
    if (state) {
      state.currentTime = currentTime;
      state.lastAccessed = Date.now();
      this.updateAccessOrder(postId);
    }
  }

  // Update pause state
  updatePauseState(postId: string, isPaused: boolean): void {
    const state = this.cache.get(postId);
    if (state) {
      state.isPaused = isPaused;
      state.lastAccessed = Date.now();
      this.updateAccessOrder(postId);
    }
  }

  // Store frozen frame for smooth pause experience
  storeFrozenFrame(postId: string, frameDataURL: string): void {
    const state = this.cache.get(postId);
    if (state) {
      state.frozenFrame = frameDataURL;
      state.estimatedSize = this.calculateSize(state);
      state.lastAccessed = Date.now();
      this.updateAccessOrder(postId);
      this.updateTotalSize();
      this.enforceLimits();
    }
  }

  // Get all states for debugging
  getAll(): MediaState[] {
    return Array.from(this.cache.values());
  }

  // Get cache statistics
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      totalEntries: this.cache.size,
      totalSizeMB: Math.round(this.totalSize / 1024 / 1024 * 100) / 100,
      maxSizeMB: this.MAX_SIZE_MB,
      hitRate: totalRequests > 0 ? Math.round(this.hits / totalRequests * 100) / 100 : 0,
      evictions: this.evictions
    };
  }

  // Clear all states
  clear(): void {
    // Clean up object URLs
    for (const state of this.cache.values()) {
      if (state.objectURL) {
        try {
          URL.revokeObjectURL(state.objectURL);
        } catch (e) {
          console.warn('[MediaStateCache] Failed to revoke object URL during clear', e);
        }
      }
    }
    
    this.cache.clear();
    this.accessOrder = [];
    this.totalSize = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    
    console.log('[MediaStateCache] Cleared all states');
  }

  // Calculate estimated size of a media state
  private calculateSize(state: MediaState): number {
    let size = this.SIZE_ESTIMATES.videoElement;
    
    if (state.posterLoaded) {
      size += this.SIZE_ESTIMATES.poster;
    }
    
    if (state.frozenFrame) {
      size += this.SIZE_ESTIMATES.frozenFrame;
    }
    
    if (state.objectURL) {
      size += this.SIZE_ESTIMATES.objectURL;
    }
    
    if (state.videoElement || state.mediaSourceRef) {
      size += this.SIZE_ESTIMATES.bufferedData;
    }
    
    return size;
  }

  // Update LRU access order
  private updateAccessOrder(postId: string): void {
    // Remove from current position
    this.removeFromAccessOrder(postId);
    // Add to end (most recent)
    this.accessOrder.push(postId);
  }

  // Remove from access order
  private removeFromAccessOrder(postId: string): void {
    const index = this.accessOrder.indexOf(postId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  // Update total size calculation
  private updateTotalSize(): void {
    this.totalSize = 0;
    for (const state of this.cache.values()) {
      this.totalSize += state.estimatedSize;
    }
  }

  // Enforce cache limits (size and count)
  private enforceLimits(): void {
    const maxSizeBytes = this.MAX_SIZE_MB * 1024 * 1024;
    
    // First, enforce entry count limit
    while (this.cache.size > this.MAX_ENTRIES) {
      this.evictLRU();
    }
    
    // Then, enforce size limit (but preserve posters if configured)
    while (this.totalSize > maxSizeBytes && this.cache.size > 0) {
      const evicted = this.evictLRU();
      if (!evicted) break; // No more evictable items
    }
  }

  // Evict least recently used item
  private evictLRU(): boolean {
    if (this.accessOrder.length === 0) return false;
    
    // Find first evictable item (skip posters if POSTER_NEVER_EVICT is true)
    let evictIndex = 0;
    if (this.POSTER_NEVER_EVICT) {
      while (evictIndex < this.accessOrder.length) {
        const postId = this.accessOrder[evictIndex];
        const state = this.cache.get(postId);
        
        // Only evict if it's not just a poster (has other data)
        if (state && (!state.posterLoaded || state.videoElement || state.frozenFrame || state.objectURL)) {
          break;
        }
        evictIndex++;
      }
      
      // If we couldn't find anything to evict, evict the oldest anyway
      if (evictIndex >= this.accessOrder.length) {
        evictIndex = 0;
      }
    }
    
    const postIdToEvict = this.accessOrder[evictIndex];
    if (postIdToEvict) {
      this.delete(postIdToEvict);
      this.evictions++;
      
      console.log('[MediaStateCache] Evicted LRU state', { 
        postId: postIdToEvict,
        totalSizeMB: Math.round(this.totalSize / 1024 / 1024 * 100) / 100
      });
      
      return true;
    }
    
    return false;
  }

  // Clean up old states (called periodically)
  cleanup(maxAge = 30 * 60 * 1000): number { // 30 minutes default
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;
    
    const toDelete: string[] = [];
    for (const [postId, state] of this.cache) {
      if (state.lastAccessed < cutoff) {
        toDelete.push(postId);
      }
    }
    
    for (const postId of toDelete) {
      this.delete(postId);
      cleaned++;
    }
    
    if (cleaned > 0) {
      console.log('[MediaStateCache] Cleaned up old states', { count: cleaned });
    }
    
    return cleaned;
  }
}

export default MediaStateCache;
