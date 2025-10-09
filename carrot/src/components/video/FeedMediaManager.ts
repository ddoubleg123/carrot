import MediaPreloadQueue, { TaskType, Priority } from '../../lib/MediaPreloadQueue';
import MediaStateCache from '../../lib/MediaStateCache';

export type VideoHandle = {
  id: string;
  el?: Element;
  play: () => Promise<void> | void;
  pause: () => void;
  warm?: () => Promise<void> | void;
  setPaused: () => void;
  release: () => void;
  getScreenPosition?: () => { top: number; bottom: number; height: number } | null;
};

enum TileState {
  Idle = 'idle',
  Warm = 'warm', 
  Paused = 'paused',
  Active = 'active'
}

export interface PostAsset {
  id: string;
  type: 'video' | 'image' | 'audio' | 'text';
  bucket?: string;
  path?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  feedIndex: number;
}

const FAST_SCROLL_THRESHOLD = 1.2;
const FAST_SCROLL_COOLDOWN = 700;
const IDLE_RELEASE_GRACE_MS = 5000;
const SCREEN_TEARDOWN_DISTANCE = 3;
const STICKY_POST_WINDOW = 10; // ±10 posts from viewport stay sticky
let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
let lastFastScroll = 0;

if (typeof window !== 'undefined' && typeof performance !== 'undefined') {
  window.addEventListener('wheel', (e: WheelEvent) => {
    try {
      const screenHeight = Math.max(1, window.innerHeight);
      const dyScreens = Math.abs(e.deltaY) / screenHeight;
      if (dyScreens >= 1.5) {
        lastFastScroll = performance.now();
      }
    } catch {}
  }, { passive: true });
}

function getScrollVelocity(): number {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return 0;
  const now = performance.now();
  const dy = Math.abs(window.scrollY - lastScrollY);
  const dt = Math.max(0.001, (now - lastTime) / 1000);
  const screenHeight = Math.max(1, window.innerHeight);

  lastScrollY = window.scrollY;
  lastTime = now;

  const v = (dy / screenHeight) / dt;
  if (v > FAST_SCROLL_THRESHOLD) lastFastScroll = now;
  return v;
}

export function isFastScroll(): boolean {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;

  const prevY = lastScrollY;
  const prevT = lastTime;

  const velocity = getScrollVelocity();
  const dyScreens = Math.abs(window.scrollY - prevY) / Math.max(1, window.innerHeight);
  const dtSec = Math.max(0.001, (lastTime - prevT) / 1000);

  const now = performance.now();
  const isFling = velocity > FAST_SCROLL_THRESHOLD || (dyScreens >= 1.5 && dtSec <= 0.25);
  if (isFling) {
    lastFastScroll = now;
    return true;
  }
  return (now - lastFastScroll) < FAST_SCROLL_COOLDOWN;
}

class FeedMediaManager {
  private static _inst: FeedMediaManager | null = null;
  static get inst(): FeedMediaManager {
    if (!this._inst) {
      this._inst = new FeedMediaManager();
      // Attach a single global click handler to promote clicked videos to manual Active
      // Only handle clicks on video elements, not on their children (like controls)
      try {
        if (typeof window !== 'undefined' && !this._inst._manualHooked) {
          window.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as Element | null;
            if (!target) return;
            
            // Only handle direct clicks on video elements, not on their children
            if (target.tagName !== 'VIDEO') return;
            
            const handle = this._inst!.getHandleByElement(target as HTMLVideoElement);
            if (handle) this._inst!.setActive(handle, { manual: true });
          }, { capture: true });
          this._inst._manualHooked = true;
        }
      } catch {}
    }
    return this._inst!;
  }

  private _active?: VideoHandle;
  private _warm?: VideoHandle;
  private _paused = new Set<VideoHandle>();
  private _handles = new WeakMap<Element, VideoHandle>();
  private _allHandles = new Set<VideoHandle>();
  private _states = new WeakMap<VideoHandle, TileState>();
  private _releaseTimers = new WeakMap<VideoHandle, number>();
  private _posts: PostAsset[] = [];
  private _currentViewportIndex = 0;
  private _screenHeight = 0;
  private _io = new WeakMap<Element, IntersectionObserver>();
  private _visibility = new WeakMap<VideoHandle, number>(); // 0..1 intersection ratio
  private _debounceTimer: number | null = null;
  private _manualActive?: VideoHandle; // manual override survives until not visible
  private _manualHooked = false; // ensure global click hook only binds once

  private preloadQueue = MediaPreloadQueue;
  private stateCache = MediaStateCache.instance;

  get active() { return this._active; }
  get warm() { return this._warm; }

  setPosts(posts: PostAsset[]): void {
    this._posts = posts;
    this.updateScreenHeight();
    this.queueInitialPosts();
    console.log('[FeedMediaManager] Initialized with posts', { 
      count: posts.length,
      videoPosts: posts.filter(p => p.type === 'video').length,
      firstFewPosts: posts.slice(0, 5).map(p => ({ id: p.id, type: p.type, hasVideoUrl: !!p.videoUrl }))
    });
  }

  setViewportIndex(index: number): void {
    const prevIndex = this._currentViewportIndex;
    this._currentViewportIndex = Math.max(0, Math.min(index, this._posts.length - 1));
    
    if (prevIndex !== this._currentViewportIndex) {
      this.updatePreloadQueue();
      this.scheduleDistantCleanup();
    }
  }

  private queueInitialPosts(): void {
    const endIndex = Math.min(25, this._posts.length); // Increased from 15 to 25 for much better preloading
    console.log(`[FeedMediaManager] Queueing initial posts: ${endIndex} posts`);
    for (let i = 0; i < endIndex; i++) {
      const post = this._posts[i];
      // First 5 posts get VISIBLE priority for immediate loading, others get NEXT_10
      const priority = i < 5 ? Priority.VISIBLE : Priority.NEXT_10;
      console.log(`[FeedMediaManager] Post ${i}: ${post.type} with priority ${priority}`);
      this.queuePostTasks(post, priority);
    }
  }

  private updatePreloadQueue(): void {
    if (this._posts.length === 0) return;

    this.cancelDistantTasks();

    const currentPost = this._posts[this._currentViewportIndex];
    if (currentPost) {
      this.queuePostTasks(currentPost, Priority.VISIBLE);
    }

    const nextStart = this._currentViewportIndex + 1;
    const nextEnd = Math.min(nextStart + 25, this._posts.length); // Increased from 15 to 25
    for (let i = nextStart; i < nextEnd; i++) {
      this.queuePostTasks(this._posts[i], Priority.NEXT_10);
    }

    const prevStart = Math.max(0, this._currentViewportIndex - 12); // Increased from 8 to 12
    const prevEnd = this._currentViewportIndex;
    for (let i = prevStart; i < prevEnd; i++) {
      this.queuePostTasks(this._posts[i], Priority.PREV_5);
    }
  }

  private validateUrl(url: string, context: string): string | null {
    if (!url || typeof url !== 'string') {
      console.warn(`[FeedMediaManager] Invalid URL in ${context}:`, url);
      return null;
    }
    
    try {
      // Test URL construction
      new URL(url.startsWith('/') ? `https://example.com${url}` : url);
      return url;
    } catch (error) {
      console.warn(`[FeedMediaManager] Invalid URL format in ${context}:`, url, error);
      return null;
    }
  }

  private queuePostTasks(post: PostAsset, priority: Priority): void {
    switch (post.type) {
      case 'video':
        // Always enqueue a POSTER for videos. Order of preference:
        // 1) Provided thumbnailUrl (proxied via /api/img)
        // 2) If bucket/path exist, ask /api/img to generate or return a poster for the object
        // 3) If only videoUrl exists, ask /api/img to generate a poster from videoUrl (fallback may be SVG)
        let posterUrl: string | null = null;
        if (post.thumbnailUrl) {
          if (post.thumbnailUrl.startsWith('/api/img')) {
            posterUrl = this.validateUrl(post.thumbnailUrl, 'thumbnailUrl (api/img)');
          } else {
            // Check if the URL is already heavily encoded (contains %25 which indicates double encoding)
            const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(post.thumbnailUrl);
            const encodedUrl = isAlreadyEncoded ? post.thumbnailUrl : encodeURIComponent(post.thumbnailUrl);
            posterUrl = this.validateUrl(`/api/img?url=${encodedUrl}`, 'thumbnailUrl (encoded)');
          }
        } else if (post.bucket && post.path) {
          const bucketPath = encodeURIComponent(post.bucket);
          const pathEncoded = encodeURIComponent(post.path);
          posterUrl = this.validateUrl(`/api/img?bucket=${bucketPath}&path=${pathEncoded}/thumb.jpg&generatePoster=1`, 'bucket/path poster');
        } else if (post.videoUrl) {
          const encodedVideoUrl = encodeURIComponent(post.videoUrl);
          posterUrl = this.validateUrl(`/api/img?generatePoster=1&videoUrl=${encodedVideoUrl}`, 'videoUrl poster');
        }
        
        if (posterUrl) {
          this.preloadQueue.enqueue(post.id, TaskType.POSTER, priority, post.feedIndex, posterUrl, post.bucket, post.path);
        }

        let videoUrl: string | null = null;
        if (post.bucket && post.path) {
          videoUrl = this.validateUrl(`/api/video?bucket=${post.bucket}&path=${post.path}/video.mp4`, 'bucket/path video');
        } else if (post.videoUrl) {
          if (post.videoUrl.startsWith('/api/video')) {
            videoUrl = this.validateUrl(post.videoUrl, 'videoUrl (api/video)');
          } else {
            // Check if the URL is already heavily encoded (contains %25 which indicates double encoding)
            const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(post.videoUrl);
            const encodedUrl = isAlreadyEncoded ? post.videoUrl : encodeURIComponent(post.videoUrl);
            videoUrl = this.validateUrl(`/api/video?url=${encodedUrl}`, 'videoUrl (encoded)');
          }
        }
        
        if (videoUrl) {
          // CRITICAL FIX: Optimize video loading - only load visible videos immediately
          // Only load full video for VISIBLE posts, defer others until they become visible
          if (priority === Priority.VISIBLE) {
            console.log(`[FeedMediaManager] Queuing FULL video for VISIBLE post ${post.id} (index ${post.feedIndex})`, {
              videoUrl: videoUrl.substring(0, 100) + '...',
              posterUrl: posterUrl?.substring(0, 100) + '...'
            });
            this.preloadQueue.enqueue(post.id, TaskType.VIDEO_FULL, priority, post.feedIndex, videoUrl, post.bucket, post.path);
          } else {
            // CRITICAL FIX: For non-visible posts, only queue poster - defer video until visible
            console.log(`[FeedMediaManager] Deferring video for post ${post.id} (index ${post.feedIndex}) - only loading poster`, {
              videoUrl: videoUrl.substring(0, 100) + '...',
              posterUrl: posterUrl?.substring(0, 100) + '...',
              priority
            });
            // Don't queue video yet - will be queued when post becomes visible
          }
        } else {
          console.warn(`[FeedMediaManager] No valid video URL for post ${post.id} (index ${post.feedIndex})`, {
            hasVideoUrl: !!post.videoUrl,
            hasBucket: !!post.bucket,
            hasPath: !!post.path,
            videoUrl: post.videoUrl?.substring(0, 100) + '...'
          });
        }
        break;

      case 'image':
        let imageUrl: string | null = null;
        if (post.thumbnailUrl) {
          imageUrl = this.validateUrl(post.thumbnailUrl, 'image thumbnailUrl');
        } else if (post.bucket && post.path) {
          imageUrl = this.validateUrl(`/api/img?bucket=${post.bucket}&path=${post.path}`, 'image bucket/path');
        }
        
        if (imageUrl) {
          this.preloadQueue.enqueue(post.id, TaskType.IMAGE, priority, post.feedIndex, imageUrl, post.bucket, post.path);
        } else {
          console.warn(`[FeedMediaManager] No valid image URL for post ${post.id} (index ${post.feedIndex})`, {
            hasThumbnailUrl: !!post.thumbnailUrl,
            hasBucket: !!post.bucket,
            hasPath: !!post.path
          });
        }
        break;

      case 'audio':
        // Audio posts are just shells - only download metadata/gradient, never the actual audio file
        // Audio file is downloaded on-demand when user clicks play
        // Prefer explicit URL if provided; otherwise construct /api/audio from bucket/path
        {
          let audioUrl: string | null = null;
          if (post.videoUrl && post.videoUrl.includes('/audio')) {
            audioUrl = this.validateUrl(post.videoUrl, 'audio videoUrl');
          } else if (post.bucket && post.path) {
            audioUrl = this.validateUrl(`/api/audio?bucket=${post.bucket}&path=${post.path}/audio.mp3`, 'audio bucket/path');
          } else if (post.videoUrl) {
            audioUrl = this.validateUrl(post.videoUrl, 'audio fallback videoUrl');
          }
          
          if (audioUrl) {
            // Always use AUDIO_META - just download the shell/gradient, not the actual audio
            console.log(`[FeedMediaManager] Queuing audio shell for post ${post.id} (index ${post.feedIndex}): AUDIO_META with priority ${priority}`);
            this.preloadQueue.enqueue(post.id, TaskType.AUDIO_META, priority, post.feedIndex, audioUrl, post.bucket, post.path);
          } else {
            console.warn(`[FeedMediaManager] No valid audio URL for post ${post.id} (index ${post.feedIndex})`, {
              hasVideoUrl: !!post.videoUrl,
              hasBucket: !!post.bucket,
              hasPath: !!post.path
            });
          }
        }
        break;

      case 'text':
        // Load the full text content (shell + gradients, etc.)
        {
          let textUrl: string | null = null;
          if (post.bucket && post.path) {
            textUrl = this.validateUrl(`/api/text?bucket=${post.bucket}&path=${post.path}/content.json`, 'text bucket/path');
          } else {
            textUrl = this.validateUrl(`/api/text?id=${encodeURIComponent(post.id)}`, 'text id');
          }
          
          if (textUrl) {
            this.preloadQueue.enqueue(post.id, TaskType.TEXT_FULL, priority, post.feedIndex, textUrl, post.bucket, post.path);
          } else {
            console.warn(`[FeedMediaManager] No valid text URL for post ${post.id} (index ${post.feedIndex})`, {
              hasBucket: !!post.bucket,
              hasPath: !!post.path,
              postId: post.id
            });
          }
        }
        break;
    }
  }

  private cancelDistantTasks(): void {
    const keepRange = 25; // Keep 25 posts ahead as specified
    const minIndex = Math.max(0, this._currentViewportIndex - 12); // Keep 12 posts behind
    const maxIndex = Math.min(this._posts.length - 1, this._currentViewportIndex + keepRange);

    for (const post of this._posts) {
      if (post.feedIndex < minIndex || post.feedIndex > maxIndex) {
        this.preloadQueue.cancelPost(post.id);
      }
    }
  }

  private updateScreenHeight(): void {
    if (typeof window !== 'undefined') {
      this._screenHeight = window.innerHeight;
    }
  }

  private scheduleDistantCleanup(): void {
    setTimeout(() => this.cleanupDistantVideos(), 500);
  }

  private cleanupDistantVideos(): void {
    if (this._screenHeight === 0) {
      this.updateScreenHeight();
    }
    if (this._screenHeight === 0) return;

    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const viewportTop = currentScrollY;
    const viewportBottom = currentScrollY + this._screenHeight;
    const teardownDistance = this._screenHeight * SCREEN_TEARDOWN_DISTANCE * 2; // CRITICAL: Doubled distance to prevent premature cleanup

    this._allHandles.forEach(handle => {
      const position = handle.getScreenPosition?.();
      if (!position) return;

      const { top, bottom } = position;
      const distanceAbove = viewportTop - bottom;
      const distanceBelow = top - viewportBottom;
      const minDistance = Math.min(
        distanceAbove > 0 ? distanceAbove : Infinity,
        distanceBelow > 0 ? distanceBelow : Infinity
      );

      const shouldRelease = this.shouldReleaseHandle(handle, minDistance, teardownDistance);
      
      if (shouldRelease) {
        const isActive = this._active === handle;
        const isWarm = this._warm === handle;
        
        // CRITICAL FIX: Never release active or warm videos to prevent playback interruption
        if (!isActive && !isWarm) {
          console.log('[FeedMediaManager] Releasing distant video (far from viewport)', { 
            id: handle.id, 
            minDistance: Math.round(minDistance),
            teardownDistance: Math.round(teardownDistance)
          });
          this.setIdle(handle);
        } else {
          console.log('[FeedMediaManager] Skipping release for active/warm video', {
            id: handle.id,
            isActive,
            isWarm
          });
        }
      }
    });
  }

  private shouldReleaseHandle(handle: VideoHandle, minDistance: number, teardownDistance: number): boolean {
    if (minDistance <= teardownDistance) {
      return false; // Keep videos within screen distance
    }

    const handlePostIndex = this.getPostIndexForHandle(handle);
    if (handlePostIndex !== -1) {
      const distanceFromViewport = Math.abs(handlePostIndex - this._currentViewportIndex);
      if (distanceFromViewport <= STICKY_POST_WINDOW) {
        console.log('[FeedMediaManager] Keeping video in sticky window', { 
          id: handle.id, 
          postIndex: handlePostIndex,
          viewportIndex: this._currentViewportIndex,
          distance: distanceFromViewport
        });
        return false; // Keep videos within ±10 posts
      }
    }

    return true; // Release videos outside both screen distance and post window
  }

  private getPostIndexForHandle(handle: VideoHandle): number {
    return this._posts.findIndex(post => post.id === handle.id);
  }

  registerHandle(el: Element, handle: VideoHandle) {
    // CRITICAL FIX: Prevent duplicate handles for the same post ID
    const existingHandle = Array.from(this._allHandles).find(h => h.id === handle.id);
    if (existingHandle) {
      console.warn('[FeedMediaManager] Duplicate handle detected, removing old one', { 
        id: handle.id, 
        oldElement: existingHandle.el?.tagName,
        newElement: el.tagName
      });
      
      // Remove the old handle completely
      this._allHandles.delete(existingHandle);
      if (existingHandle.el) {
        this._handles.delete(existingHandle.el);
        this._states.delete(existingHandle);
        this._paused.delete(existingHandle);
        this._visibility.delete(existingHandle);
        this._releaseTimers.delete(existingHandle);
        
        // If it was the active or warm handle, clear it
        if (this._active === existingHandle) this._active = undefined;
        if (this._warm === existingHandle) this._warm = undefined;
        if (this._manualActive === existingHandle) this._manualActive = undefined;
        
        // Clean up intersection observer
        const oldIO = this._io.get(existingHandle.el);
        if (oldIO) {
          oldIO.disconnect();
          this._io.delete(existingHandle.el);
        }
      }
    }
    
    handle.el = el;
    this._handles.set(el, handle);
    this._allHandles.add(handle);
    this._states.set(handle, TileState.Idle);

    // Attach IntersectionObserver to track visibility ratio for active winner selection
    try {
      const cb: IntersectionObserverCallback = (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const ratio = entry.intersectionRatio || 0;
        this._visibility.set(handle, ratio);
        this.scheduleActiveRecalc();
      };
      const io = new IntersectionObserver(cb, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], root: null, rootMargin: '0px' });
      this._io.set(el, io);
      io.observe(el);
    } catch {}
  }
  
  unregisterHandle(el: Element) {
    const handle = this._handles.get(el);
    if (handle) {
      try { this._visibility.delete(handle); } catch {}
      const io = this._io.get(el);
      if (io) { try { io.unobserve(el); io.disconnect(); } catch {}; this._io.delete(el); }
      
      const timer = this._releaseTimers.get(handle);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(handle);
      }
      
      this._allHandles.delete(handle);
      this._states.delete(handle);
      this._paused.delete(handle);
      if (this._active === handle) this._active = undefined;
      if (this._warm === handle) this._warm = undefined;
      if (this._manualActive === handle) this._manualActive = undefined;
    }
    this._handles.delete(el);
  }
  
  getHandleByElement(el: Element): VideoHandle | undefined {
    return this._handles.get(el);
  }

  getState(handle: VideoHandle): TileState {
    return this._states.get(handle) || TileState.Idle;
  }

  setActive(next?: VideoHandle, opts?: { manual?: boolean }) {
    if (next) {
      const timer = this._releaseTimers.get(next);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(next);
      }
      
      const cachedState = this.stateCache.get(next.id);
      if (cachedState) {
        console.log('[FeedMediaManager] Resuming from cache', { 
          id: next.id, 
          currentTime: cachedState.currentTime 
        });
        
        // Restore the video state from cache
        try {
          const video = next.el?.querySelector('video');
          if (video && cachedState.currentTime > 0) {
            video.currentTime = cachedState.currentTime;
          }
        } catch (e) {
          console.warn('[FeedMediaManager] Failed to restore video time from cache', { id: next.id, error: e });
        }
      }
      if (opts?.manual) {
        this._manualActive = next;
      }
    }

    // CRITICAL: Ensure only one video plays at a time
    if (this._active && this._active !== next) {
      try { 
        this._active.pause(); 
        if (this._active.setPaused) this._active.setPaused();
        
        this.storeVideoState(this._active);
        
        this._states.set(this._active, TileState.Paused);
        this._paused.add(this._active);
        
        console.log('[FeedMediaManager] Paused previous active video', { id: this._active.id });
      } catch {}
    }
    
    this._active = next;
    if (next) {
      this._paused.delete(next);
      if (this._warm === next) this._warm = undefined;
      
      this._states.set(next, TileState.Active);
      
      // Promote this video to full download since it's now active
      this.promoteActiveVideoToFull(next);
      
      // CRITICAL FIX: Check video readyState before calling play()
      const video = next.el?.querySelector('video') as HTMLVideoElement;
      if (video) {
        if (video.readyState >= 2) {
          // Video is ready to play
          try { 
            void next.play(); 
            console.log('[FeedMediaManager] Play started immediately (ready)', { 
              id: next.id, 
              readyState: video.readyState 
            });
          } catch (e) {
            console.warn('[FeedMediaManager] Play failed immediately:', e);
          }
        } else {
          // Wait for video to be ready, then play
          console.log('[FeedMediaManager] Waiting for video ready before play', { 
            id: next.id, 
            readyState: video.readyState 
          });
          const playWhenReady = async () => {
            try { 
              await next.play(); 
              console.log('[FeedMediaManager] Play started after canplay', { 
                id: next.id 
              });
            } catch (e) {
              console.warn('[FeedMediaManager] Play failed after canplay:', e);
            }
            video.removeEventListener('canplay', playWhenReady);
          };
          video.addEventListener('canplay', playWhenReady, { once: true });
          
          // Fallback: try to play after 3 seconds regardless
          setTimeout(() => {
            video.removeEventListener('canplay', playWhenReady);
            if (video.paused) {
              const playPromise = next.play();
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(e => console.warn('[FeedMediaManager] Fallback play failed:', e));
              }
            }
          }, 3000);
        }
      } else {
        // No video element found, try play anyway
        try { void next.play(); } catch (e) {
          console.warn('[FeedMediaManager] No video element found for handle:', next.id);
        }
      }
      
      console.log('[FeedMediaManager] Active set', { 
        id: next.id, 
        preloaded: this.preloadQueue.isCompleted(next.id, TaskType.VIDEO_PREROLL_6S),
        fullVideoQueued: this.preloadQueue.isCompleted(next.id, TaskType.VIDEO_FULL)
      });
    }
  }

  private scheduleActiveRecalc(delay = 150) {
    if (this._debounceTimer) window.clearTimeout(this._debounceTimer);
    this._debounceTimer = window.setTimeout(() => {
      this._debounceTimer = null;
      this.updateActiveFromViewport();
    }, delay);
  }

  private updateActiveFromViewport() {
    // If manual active exists and still visible, keep it
    if (this._manualActive) {
      const ratio = this._manualActive.el ? (this._visibility.get(this._handles.get(this._manualActive.el!) || this._manualActive) || 0) : 0;
      if (ratio > 0) return; // still visible: honor manual
      this._manualActive = undefined; // no longer visible: release manual override
    }

    // Choose the handle with the highest intersection ratio
    let best: VideoHandle | undefined;
    let bestRatio = 0;
    for (const h of this._allHandles) {
      const r = this._visibility.get(h) || 0;
      if (r > bestRatio) { bestRatio = r; best = h; }
    }
    if (best && best !== this._active) {
      this.setActive(best);
    }
  }

  private promoteActiveVideoToFull(handle: VideoHandle): void {
    // Find the post data for this handle
    const post = this._posts.find(p => p.id === handle.id);
    if (!post || post.type !== 'video') {
      return;
    }

    // Check if we already have a full video task queued or completed
    if (this.preloadQueue.isCompleted(handle.id, TaskType.VIDEO_FULL)) {
      console.log('[FeedMediaManager] Full video already available', { id: handle.id });
      return;
    }

    // Construct the video URL
    const videoUrl = (post.bucket && post.path)
      ? `/api/video?bucket=${post.bucket}&path=${post.path}/video.mp4`
      : (post.videoUrl ? (post.videoUrl.startsWith('/api/video') ? post.videoUrl : `/api/video?url=${encodeURIComponent(post.videoUrl)}`) : null);

    if (videoUrl) {
      this.preloadQueue.promoteToFullVideo(handle.id, videoUrl, post.bucket, post.path);
      console.log('[FeedMediaManager] Promoted active video to full download', { 
        id: handle.id, 
        videoUrl: videoUrl.substring(0, 100) + '...' 
      });
    }
  }

  private cancelFullVideoDownload(handle: VideoHandle): void {
    const taskId = `${TaskType.VIDEO_FULL}:${handle.id}`;
    const cancelled = this.preloadQueue.cancel(taskId);
    if (cancelled) {
      console.log('[FeedMediaManager] Cancelled full video download for paused video', { id: handle.id });
    }
  }

  setWarm(next?: VideoHandle) {
    if (isFastScroll()) {
      console.debug('[FeedMediaManager] Skipping preload due to fast scroll', { id: next?.id });
      return;
    }

    if (next) {
      const timer = this._releaseTimers.get(next);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(next);
      }
    }

    if (this._warm && this._warm !== next) {
      try { 
        this._warm.release(); 
        this._states.set(this._warm, TileState.Idle);
      } catch {}
    }
    
    this._warm = next;
    if (next && (!this._active || this._active !== next)) {
      this._paused.delete(next);
      this._states.set(next, TileState.Warm);
      try { void next.warm?.(); } catch {}
      
      console.log('[FeedMediaManager] Warm set', { 
        id: next.id, 
        preloaded: this.preloadQueue.isCompleted(next.id, TaskType.POSTER) 
      });
    }
  }

  setPaused(handle?: VideoHandle) {
    if (!handle) return;
    
    const timer = this._releaseTimers.get(handle);
    if (timer) {
      clearTimeout(timer);
      this._releaseTimers.delete(handle);
    }
    
    const currentState = this._states.get(handle);
    
    if (currentState === TileState.Active || currentState === TileState.Warm) {
      try { 
        handle.pause(); 
        
        this.storeVideoState(handle, true);
        
        if (handle.setPaused) {
          handle.setPaused();
        }
        
        // Cancel any ongoing full video download for this paused video
        this.cancelFullVideoDownload(handle);
        
        console.log('[FeedMediaManager] Video paused and state preserved', { 
          id: handle.id,
          postIndex: this.getPostIndexForHandle(handle),
          viewportIndex: this._currentViewportIndex
        });
      } catch (e) {
        console.warn('[FeedMediaManager] Error pausing video', { id: handle.id, error: e });
      }
      
      this._states.set(handle, TileState.Paused);
      this._paused.add(handle);
      
      if (this._active === handle) this._active = undefined;
      if (this._warm === handle) this._warm = undefined;
    }
  }

  setIdle(handle?: VideoHandle) {
    if (!handle) return;
    
    const existingTimer = this._releaseTimers.get(handle);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const handlePostIndex = this.getPostIndexForHandle(handle);
    const distanceFromViewport = handlePostIndex !== -1 ? 
      Math.abs(handlePostIndex - this._currentViewportIndex) : Infinity;
    
    if (distanceFromViewport <= STICKY_POST_WINDOW) {
      console.log('[FeedMediaManager] Keeping video in sticky state instead of idle', { 
        id: handle.id, 
        postIndex: handlePostIndex,
        distance: distanceFromViewport
      });
      
      this.setPaused(handle);
      return;
    }
    
    const timer = window.setTimeout(() => {
      const currentState = this._states.get(handle);
      if (currentState === TileState.Active || currentState === TileState.Warm) {
        return;
      }
      
      console.log('[FeedMediaManager] Releasing video outside sticky window', { 
        id: handle.id,
        postIndex: handlePostIndex,
        distance: distanceFromViewport
      });
      
      try { 
        handle.pause(); 
        handle.release(); 
      } catch (e) {
        console.warn('[FeedMediaManager] Error releasing video', { id: handle.id, error: e });
      }
      
      this._states.set(handle, TileState.Idle);
      this._paused.delete(handle);
      if (this._active === handle) this._active = undefined;
      if (this._warm === handle) this._warm = undefined;
      this._releaseTimers.delete(handle);
      
    }, IDLE_RELEASE_GRACE_MS);
    
    this._releaseTimers.set(handle, timer);
  }

  private storeVideoState(handle: VideoHandle, captureFrozenFrame = false): void {
    if (!handle.el) return;
    
    const video = handle.el.querySelector('video');
    if (!video) return;
    
    const bufferedRanges: { start: number; end: number }[] = [];
    for (let i = 0; i < video.buffered.length; i++) {
      bufferedRanges.push({
        start: video.buffered.start(i),
        end: video.buffered.end(i)
      });
    }
    
    this.stateCache.set(handle.id, {
      currentTime: video.currentTime,
      isPaused: video.paused,
      duration: video.duration,
      bufferedRanges,
      posterLoaded: !!video.poster,
      videoElement: video
    });
    
    if (captureFrozenFrame) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const frameDataURL = canvas.toDataURL('image/jpeg', 0.8);
          this.stateCache.storeFrozenFrame(handle.id, frameDataURL);
        }
      } catch (e) {
        console.warn('[FeedMediaManager] Failed to capture frozen frame', e);
      }
    }
  }

  restorePausedState(handle: VideoHandle): boolean {
    const cachedState = this.stateCache.get(handle.id);
    if (!cachedState) return false;

    try {
      const video = handle.el?.querySelector('video');
      if (!video) return false;

      if (cachedState.currentTime > 0) {
        video.currentTime = cachedState.currentTime;
      }

      video.pause();

      console.log('[FeedMediaManager] Restored paused state', { 
        id: handle.id, 
        currentTime: cachedState.currentTime,
        hasFrozenFrame: !!cachedState.frozenFrame
      });

      return true;
    } catch (e) {
      console.warn('[FeedMediaManager] Failed to restore paused state', { id: handle.id, error: e });
      return false;
    }
  }

  isInStickyState(handle: VideoHandle): boolean {
    const state = this._states.get(handle);
    const handlePostIndex = this.getPostIndexForHandle(handle);
    const distanceFromViewport = handlePostIndex !== -1 ? 
      Math.abs(handlePostIndex - this._currentViewportIndex) : Infinity;
    
    return state === TileState.Paused && distanceFromViewport <= STICKY_POST_WINDOW;
  }

  getStickyStats() {
    const stickyVideos = Array.from(this._allHandles).filter(handle => this.isInStickyState(handle));
    const totalPaused = this._paused.size;
    const totalHandles = this._allHandles.size;
    
    return {
      stickyVideos: stickyVideos.length,
      totalPaused,
      totalHandles,
      viewportIndex: this._currentViewportIndex,
      stickyWindow: STICKY_POST_WINDOW,
      stickyVideoIds: stickyVideos.map(h => h.id)
    };
  }

  clearAll() {
    this._allHandles.forEach((handle: VideoHandle) => {
      const timer = this._releaseTimers.get(handle);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(handle);
      }
    });
    
    if (this._active) { 
      try { this._active.pause(); this._active.release(); } catch {} 
    }
    if (this._warm) { 
      try { this._warm.release(); } catch {} 
    }
    for (const paused of this._paused) {
      try { paused.release(); } catch {}
    }
    this._active = undefined;
    this._warm = undefined;
    this._paused.clear();
    this._allHandles.clear();
    this._manualActive = undefined;
  }
}

export default FeedMediaManager;
