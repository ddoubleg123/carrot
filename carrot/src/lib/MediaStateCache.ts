interface MediaState {
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

interface CacheStats {
  totalEntries: number;
  totalSizeMB: number;
  maxSizeMB: number;
  hitRate: number;
  evictions: number;
  frozenFrameCount: number;
  frozenFrameSizeMB: number;
}

interface CacheEntry {
  state: MediaState;
  lastAccessed: number;
  size: number; // Size in bytes
  frozenFrameSize?: number; // Separate tracking for frozen frame size
}

// Singleton MediaStateCache for video state persistence
class MediaStateCache {
  private static _instance: MediaStateCache | null = null;
  
  static get instance(): MediaStateCache {
    if (!this._instance) {
      this._instance = new MediaStateCache();
    }
    return this._instance;
  }

  private cache = new Map<string, CacheEntry>();
  private maxSizeMB: number;
  private maxFrozenFramesMB: number; // PHASE B.2: Separate budget for frozen frames
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSizeMB = 120, maxFrozenFramesMB = 50) { // PHASE B.2: 50MB for frozen frames
    this.maxSizeMB = maxSizeMB;
    this.maxFrozenFramesMB = maxFrozenFramesMB;
  }

  // Store media state with size calculation
  set(postId: string, state: Partial<MediaState>): void {
    const existing = this.cache.get(postId);
    const now = Date.now();
    
    let newState: MediaState;
    if (existing) {
      // Update existing state
      newState = {
        ...existing.state,
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
    const size = this.calculateStateSize(newState);
    const entry: CacheEntry = {
      state: newState,
      lastAccessed: now,
      size,
      frozenFrameSize: newState.frozenFrame ? this.estimateImageSize(newState.frozenFrame) : 0
    };

    // Remove existing entry if present
    if (this.cache.has(postId)) {
      this.cache.delete(postId);
    }

    this.cache.set(postId, entry);
    this.enforceMemoryLimits();
    
    console.log('[MediaStateCache] Stored state', { 
      postId, 
      sizeMB: Math.round(size / 1024 / 1024 * 100) / 100,
      hasFrozenFrame: !!newState.frozenFrame,
      totalEntries: this.cache.size 
    });
  }

  // Get media state with hit tracking
  get(postId: string): MediaState | undefined {
    const entry = this.cache.get(postId);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.hits++;
      return entry.state;
    }
    
    this.misses++;
    return undefined;
  }

  // PHASE B.2: Enhanced frozen frame storage with size tracking
  storeFrozenFrame(postId: string, frameDataURL: string): void {
    const entry = this.cache.get(postId);
    if (entry) {
      const oldFrameSize = entry.frozenFrameSize || 0;
      const newFrameSize = this.estimateImageSize(frameDataURL);
      
      entry.state.frozenFrame = frameDataURL;
      entry.frozenFrameSize = newFrameSize;
      entry.size = entry.size - oldFrameSize + newFrameSize;
      entry.lastAccessed = Date.now();
      
      console.log('[MediaStateCache] Stored frozen frame', { 
        postId, 
        frameSizeMB: Math.round(newFrameSize / 1024 / 1024 * 100) / 100,
        totalFramesMB: Math.round(this.getTotalFrozenFrameSize() / 1024 / 1024 * 100) / 100
      });
      
      this.enforceMemoryLimits();
    } else {
      // Create new entry with just the frozen frame
      const frameSize = this.estimateImageSize(frameDataURL);
      const newEntry: CacheEntry = {
        state: {
          postId,
          currentTime: 0,
          isPaused: true,
          duration: 0,
          bufferedRanges: [],
          posterLoaded: false,
          frozenFrame: frameDataURL,
          lastAccessed: Date.now(),
          estimatedSize: frameSize
        },
        lastAccessed: Date.now(),
        size: frameSize,
        frozenFrameSize: frameSize
      };
      
      this.cache.set(postId, newEntry);
      this.enforceMemoryLimits();
      
      console.log('[MediaStateCache] Created entry with frozen frame', { 
        postId, 
        frameSizeMB: Math.round(frameSize / 1024 / 1024 * 100) / 100
      });
    }
  }

  // Update pause state without affecting frozen frame
  updatePauseState(postId: string, isPaused: boolean): void {
    const entry = this.cache.get(postId);
    if (entry) {
      entry.state.isPaused = isPaused;
      entry.lastAccessed = Date.now();
    }
  }

  // Update current time
  updateTime(postId: string, currentTime: number): void {
    const entry = this.cache.get(postId);
    if (entry) {
      entry.state.currentTime = currentTime;
      entry.lastAccessed = Date.now();
    }
  }

  // PHASE B.2: Enhanced memory limit enforcement
  private enforceMemoryLimits(): void {
    const totalSize = this.getTotalSize();
    const frozenFrameSize = this.getTotalFrozenFrameSize();
    const maxTotalBytes = this.maxSizeMB * 1024 * 1024;
    const maxFrameBytes = this.maxFrozenFramesMB * 1024 * 1024;

    // Check if we exceed frozen frame budget specifically
    if (frozenFrameSize > maxFrameBytes) {
      this.evictOldestFrozenFrames(frozenFrameSize - maxFrameBytes);
    }

    // Check total size budget
    if (totalSize > maxTotalBytes) {
      this.evictOldestEntries(totalSize - maxTotalBytes);
    }
  }

  // PHASE B.2: Evict oldest frozen frames specifically
  private evictOldestFrozenFrames(bytesToFree: number): void {
    const entriesWithFrames = Array.from(this.cache.entries())
      .filter(([_, entry]) => entry.state.frozenFrame)
      .sort(([_, a], [__, b]) => a.lastAccessed - b.lastAccessed);

    let freedBytes = 0;
    for (const [postId, entry] of entriesWithFrames) {
      if (freedBytes >= bytesToFree) break;

      const frameSize = entry.frozenFrameSize || 0;
      
      // Remove frozen frame but keep the rest of the state
      entry.state.frozenFrame = undefined;
      entry.size -= frameSize;
      entry.frozenFrameSize = 0;
      freedBytes += frameSize;
      
      console.log('[MediaStateCache] Evicted frozen frame', { 
        postId, 
        frameSizeMB: Math.round(frameSize / 1024 / 1024 * 100) / 100,
        freedMB: Math.round(freedBytes / 1024 / 1024 * 100) / 100
      });
    }
  }

  // Enhanced LRU eviction
  private evictOldestEntries(bytesToFree: number): void {
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([_, a], [__, b]) => a.lastAccessed - b.lastAccessed);

    let freedBytes = 0;
    for (const [postId, entry] of sortedEntries) {
      if (freedBytes >= bytesToFree) break;

      // Never evict poster-only entries (they're small and important)
      if (entry.state.posterLoaded && !entry.state.frozenFrame && entry.state.currentTime === 0) {
        continue;
      }

      freedBytes += entry.size;
      this.cache.delete(postId);
      this.evictions++;
      
      console.log('[MediaStateCache] Evicted entry', { 
        postId, 
        sizeMB: Math.round(entry.size / 1024 / 1024 * 100) / 100,
        hadFrozenFrame: !!entry.state.frozenFrame
      });
    }
  }

  // Calculate total size of all cached data
  private getTotalSize(): number {
    return Array.from(this.cache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  // PHASE B.2: Calculate total size of frozen frames specifically
  private getTotalFrozenFrameSize(): number {
    return Array.from(this.cache.values()).reduce((total, entry) => total + (entry.frozenFrameSize || 0), 0);
  }

  // Estimate size of media state in bytes
  private calculateStateSize(state: MediaState): number {
    let size = 100; // Base size for primitives
    
    // Buffered ranges
    size += state.bufferedRanges.length * 16; // ~16 bytes per range
    
    // Video element reference (minimal)
    if (state.videoElement) size += 50;
    
    // Frozen frame
    if (state.frozenFrame) {
      size += this.estimateImageSize(state.frozenFrame);
    }
    
    return size;
  }

  // PHASE B.2: Improved image size estimation
  private estimateImageSize(dataURL: string): number {
    try {
      // Remove data URL prefix to get base64 data
      const base64Data = dataURL.split(',')[1] || dataURL;
      
      // Base64 encoding adds ~33% overhead, so actual size is ~75% of base64 length
      const estimatedSize = Math.round(base64Data.length * 0.75);
      
      return estimatedSize;
    } catch {
      // Fallback: assume 100KB for unknown images
      return 100 * 1024;
    }
  }

  // Get comprehensive stats
  getStats(): CacheStats {
    const totalSize = this.getTotalSize();
    const frozenFrameSize = this.getTotalFrozenFrameSize();
    const frozenFrameCount = Array.from(this.cache.values())
      .filter(entry => entry.state.frozenFrame).length;
    
    return {
      totalEntries: this.cache.size,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      maxSizeMB: this.maxSizeMB,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      evictions: this.evictions,
      frozenFrameCount,
      frozenFrameSizeMB: Math.round(frozenFrameSize / 1024 / 1024 * 100) / 100
    };
  }

  // Check if entry exists
  has(postId: string): boolean {
    return this.cache.has(postId);
  }

  // Remove specific entry
  delete(postId: string): boolean {
    const entry = this.cache.get(postId);
    if (entry) {
      console.log('[MediaStateCache] Deleted entry', { 
        postId, 
        sizeMB: Math.round(entry.size / 1024 / 1024 * 100) / 100
      });
    }
    return this.cache.delete(postId);
  }

  // Clear all entries
  clear(): void {
    const totalSize = this.getTotalSize();
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    
    console.log('[MediaStateCache] Cleared all entries', { 
      freedMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    });
  }

  // Cleanup old entries (older than maxAge)
  cleanup(maxAge = 30 * 60 * 1000): void { // 30 minutes default
    const cutoff = Date.now() - maxAge;
    let cleanedCount = 0;
    let freedBytes = 0;

    for (const [postId, entry] of this.cache.entries()) {
      if (entry.lastAccessed < cutoff) {
        freedBytes += entry.size;
        this.cache.delete(postId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log('[MediaStateCache] Cleaned up old entries', { 
        cleanedCount, 
        freedMB: Math.round(freedBytes / 1024 / 1024 * 100) / 100
      });
    }
  }
}

export default MediaStateCache;
