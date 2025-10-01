export interface PostAsset {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video';
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  bucket?: string;
  path?: string;
}

export interface PreloadedAsset {
  id: string;
  type: string;
  thumbnailBlob?: Blob;
  videoBuffer?: ArrayBuffer;
  audioBuffer?: ArrayBuffer;
  loadedAt: number;
  lastAccessed: number;
}

// LRU Cache for preloaded assets
class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
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
}

// Singleton FeedPreloadManager
class FeedPreloadManager {
  private static _instance: FeedPreloadManager | null = null;
  
  static get instance(): FeedPreloadManager {
    if (!this._instance) {
      this._instance = new FeedPreloadManager();
    }
    return this._instance;
  }

  private assetCache = new LRUCache<PreloadedAsset>(100);
  private preloadQueue: PostAsset[] = [];
  private isProcessing = false;
  private currentViewportIndex = 0;
  private posts: PostAsset[] = [];

  // Initialize with posts array
  setPosts(posts: PostAsset[]): void {
    this.posts = posts;
    this.updatePreloadQueue();
  }

  // Update current viewport position
  setViewportIndex(index: number): void {
    this.currentViewportIndex = Math.max(0, Math.min(index, this.posts.length - 1));
    this.updatePreloadQueue();
  }

  // Update preload queue based on current viewport
  private updatePreloadQueue(): void {
    if (this.posts.length === 0) return;

    // Clear existing queue
    this.preloadQueue = [];

    // Add next 10 posts from viewport in strict order
    const startIndex = this.currentViewportIndex;
    const endIndex = Math.min(startIndex + 10, this.posts.length);

    for (let i = startIndex; i < endIndex; i++) {
      const post = this.posts[i];
      if (!this.assetCache.has(post.id)) {
        this.preloadQueue.push(post);
      }
    }

    // Start processing if not already running
    if (!this.isProcessing && this.preloadQueue.length > 0) {
      this.processPreloadQueue();
    }
  }

  // Process preload queue in strict order
  private async processPreloadQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) return;

    this.isProcessing = true;
    console.log('[FeedPreloadManager] Starting preload queue processing', { queueLength: this.preloadQueue.length });

    try {
      while (this.preloadQueue.length > 0) {
        const post = this.preloadQueue.shift()!;
        
        // Skip if already cached
        if (this.assetCache.has(post.id)) continue;

        console.log('[FeedPreloadManager] Preloading post', { id: post.id, type: post.type });

        switch (post.type) {
          case 'video':
            await this.preloadVideo(post);
            break;
          case 'image':
            await this.preloadImage(post);
            break;
          case 'audio':
            await this.preloadAudio(post);
            break;
          case 'text':
            // Text posts don't need preloading
            this.assetCache.set(post.id, {
              id: post.id,
              type: 'text',
              loadedAt: Date.now(),
              lastAccessed: Date.now()
            });
            break;
        }

        // Small delay to prevent overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('[FeedPreloadManager] Error processing preload queue', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Preload video: thumbnail only (video preloading handled by FeedMediaManager)
  private async preloadVideo(post: PostAsset): Promise<void> {
    try {
      const asset: PreloadedAsset = {
        id: post.id,
        type: 'video',
        loadedAt: Date.now(),
        lastAccessed: Date.now()
      };

      // Only load thumbnail (video preloading is handled by FeedMediaManager to avoid duplicate requests)
      if (post.thumbnailUrl || (post.bucket && post.path)) {
        const thumbnailUrl = post.thumbnailUrl || 
          (post.bucket && post.path ? `/api/img?bucket=${post.bucket}&path=${post.path}/thumb.jpg&generatePoster=true` : null);
        
        if (thumbnailUrl) {
          try {
            const response = await fetch(thumbnailUrl);
            if (response.ok) {
              asset.thumbnailBlob = await response.blob();
              console.log('[FeedPreloadManager] Thumbnail loaded', { id: post.id });
            }
          } catch (e) {
            console.warn('[FeedPreloadManager] Thumbnail load failed', { id: post.id, error: e });
          }
        }
      }

      // Cache the asset (without video buffer to avoid duplicate requests)
      this.assetCache.set(post.id, asset);
      console.log('[FeedPreloadManager] Thumbnail preload complete (video handled by FeedMediaManager)', { id: post.id });

    } catch (error) {
      console.error('[FeedPreloadManager] Video preload error', { id: post.id, error });
    }
  }

  // Preload image
  private async preloadImage(post: PostAsset): Promise<void> {
    try {
      const imageUrl = post.thumbnailUrl || 
        (post.bucket && post.path ? `/api/img?bucket=${post.bucket}&path=${post.path}` : null);
      
      if (imageUrl) {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          this.assetCache.set(post.id, {
            id: post.id,
            type: 'image',
            thumbnailBlob: blob,
            loadedAt: Date.now(),
            lastAccessed: Date.now()
          });
          console.log('[FeedPreloadManager] Image preload complete', { id: post.id });
        }
      }
    } catch (error) {
      console.error('[FeedPreloadManager] Image preload error', { id: post.id, error });
    }
  }

  // Preload audio
  private async preloadAudio(post: PostAsset): Promise<void> {
    try {
      if (!post.audioUrl) return;

      const response = await fetch(post.audioUrl, {
        headers: { 'Range': 'bytes=0-524288' } // First 512KB
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        this.assetCache.set(post.id, {
          id: post.id,
          type: 'audio',
          audioBuffer: buffer,
          loadedAt: Date.now(),
          lastAccessed: Date.now()
        });
        console.log('[FeedPreloadManager] Audio preload complete', { id: post.id });
      }
    } catch (error) {
      console.error('[FeedPreloadManager] Audio preload error', { id: post.id, error });
    }
  }

  // Get preloaded asset
  getAsset(id: string): PreloadedAsset | undefined {
    const asset = this.assetCache.get(id);
    if (asset) {
      asset.lastAccessed = Date.now();
    }
    return asset;
  }

  // Check if asset is preloaded
  isPreloaded(id: string): boolean {
    return this.assetCache.has(id);
  }

  // Get cache stats
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.assetCache.size(),
      maxSize: 100
    };
  }

  // Clear cache
  clearCache(): void {
    this.assetCache.clear();
    this.preloadQueue = [];
    this.isProcessing = false;
  }
}

export default FeedPreloadManager;
