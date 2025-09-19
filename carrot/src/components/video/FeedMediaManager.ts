import FeedPreloadManager, { PostAsset } from './FeedPreloadManager';

export type VideoHandle = {
  id: string;
  el?: Element; // associated DOM element for identification
  play: () => Promise<void> | void;
  pause: () => void;
  warm?: () => Promise<void> | void; // attach media, load playlist + first segment
  setPaused: () => void; // pause but keep attached, show poster
  release: () => void; // detach media/destroy hls, free decoder
  getScreenPosition?: () => { top: number; bottom: number; height: number } | null;
};

enum TileState {
  Idle = 'idle',
  Warm = 'warm', 
  Paused = 'paused',
  Active = 'active'
}

// Track scroll velocity (screens/sec) for fast-scroll guard
const FAST_SCROLL_THRESHOLD = 1.2; // screens per second
const FAST_SCROLL_COOLDOWN = 700; // ms
const IDLE_RELEASE_GRACE_MS = 5000; // delay before teardown to prevent thrash
const SCREEN_TEARDOWN_DISTANCE = 3; // screens away before teardown
let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
let lastFastScroll = 0;

// Immediately mark flings on wheel to ensure cooldown starts at scroll time
if (typeof window !== 'undefined' && typeof performance !== 'undefined') {
  window.addEventListener('wheel', (e: WheelEvent) => {
    try {
      const screenHeight = Math.max(1, window.innerHeight);
      const dyScreens = Math.abs(e.deltaY) / screenHeight;
      // Treat >=1.5 screens in a single wheel event as a fling
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
  const dt = Math.max(0.001, (now - lastTime) / 1000); // seconds, avoid division by zero
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

  const velocity = getScrollVelocity(); // updates lastScrollY/lastTime
  const dyScreens = Math.abs(window.scrollY - prevY) / Math.max(1, window.innerHeight);
  const dtSec = Math.max(0.001, (lastTime - prevT) / 1000);

  // Treat as fast if velocity exceeds threshold or a large jump (>=1.5 screens) happens within 250ms
  const now = performance.now();
  const isFling = velocity > FAST_SCROLL_THRESHOLD || (dyScreens >= 1.5 && dtSec <= 0.25);
  if (isFling) {
    lastFastScroll = now;
    return true;
  }
  return (now - lastFastScroll) < FAST_SCROLL_COOLDOWN;
}

// Singleton controller to ensure at most 1 Active and deterministic Warm/Paused states.
class FeedMediaManager {
  private static _inst: FeedMediaManager | null = null;
  static get inst(): FeedMediaManager {
    if (!this._inst) this._inst = new FeedMediaManager();
    return this._inst!;
  }

  private _active?: VideoHandle;
  private _warm?: VideoHandle;
  private _paused = new Set<VideoHandle>();
  private _handles = new WeakMap<Element, VideoHandle>();
  private _allHandles = new Set<VideoHandle>(); // Track all handles for iteration
  private _states = new WeakMap<VideoHandle, TileState>();
  private _releaseTimers = new WeakMap<VideoHandle, number>();
  private _posts: PostAsset[] = [];
  private _currentViewportIndex = 0;
  private _screenHeight = 0;

  get active() { return this._active; }
  get warm() { return this._warm; }

  // Initialize with posts for preload management
  setPosts(posts: PostAsset[]): void {
    this._posts = posts;
    FeedPreloadManager.instance.setPosts(posts);
    this.updateScreenHeight();
  }

  // Update viewport position for preload queue
  setViewportIndex(index: number): void {
    this._currentViewportIndex = index;
    FeedPreloadManager.instance.setViewportIndex(index);
    this.scheduleDistantCleanup();
  }

  // Update screen height for distance calculations
  private updateScreenHeight(): void {
    if (typeof window !== 'undefined') {
      this._screenHeight = window.innerHeight;
    }
  }

  // Schedule cleanup of videos that are 3+ screens away
  private scheduleDistantCleanup(): void {
    setTimeout(() => this.cleanupDistantVideos(), 500);
  }

  // Clean up videos that are 3+ screens away
  private cleanupDistantVideos(): void {
    if (this._screenHeight === 0) {
      this.updateScreenHeight();
    }
    if (this._screenHeight === 0) return;

    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const viewportTop = currentScrollY;
    const viewportBottom = currentScrollY + this._screenHeight;
    const teardownDistance = this._screenHeight * SCREEN_TEARDOWN_DISTANCE;

    // Check all registered handles
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

      // If video is more than 3 screens away and not active/warm, schedule teardown
      if (minDistance > teardownDistance) {
        const isActive = this._active === handle;
        const isWarm = this._warm === handle;
        
        if (!isActive && !isWarm) {
          const screens = Math.round(minDistance / this._screenHeight * 10) / 10;
          console.log('[FeedMediaManager] Scheduling distant video teardown', { 
            id: handle.id, 
            screens: screens
          });
          this.setIdle(handle);
        }
      }
    });
  }

  registerHandle(el: Element, handle: VideoHandle) {
    handle.el = el;
    this._handles.set(el, handle);
    this._allHandles.add(handle);
    this._states.set(handle, TileState.Idle);
  }
  
  unregisterHandle(el: Element) {
    const handle = this._handles.get(el);
    if (handle) {
      // Cancel any pending release timer
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
    }
    this._handles.delete(el);
  }
  
  getHandleByElement(el: Element): VideoHandle | undefined {
    return this._handles.get(el);
  }

  getState(handle: VideoHandle): TileState {
    return this._states.get(handle) || TileState.Idle;
  }

  setActive(next?: VideoHandle) {
    // Cancel pending teardown for next
    if (next) {
      const timer = this._releaseTimers.get(next);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(next);
      }
    }

    // Pause previous active (don't release - move to Paused if still visible)
    if (this._active && this._active !== next) {
      try { 
        this._active.pause(); 
        if (this._active.setPaused) this._active.setPaused();
        this._states.set(this._active, TileState.Paused);
        this._paused.add(this._active);
      } catch {}
    }
    
    this._active = next;
    if (next) {
      // Remove from other states
      this._paused.delete(next);
      if (this._warm === next) this._warm = undefined;
      
      this._states.set(next, TileState.Active);
      try { void next.play(); } catch {}
      
      console.log('[FeedMediaManager] Active set', { 
        id: next.id, 
        preloaded: FeedPreloadManager.instance.isPreloaded(next.id) 
      });
    }
  }

  setWarm(next?: VideoHandle) {
    if (isFastScroll()) {
      console.debug('[FeedMediaManager] Skipping preload due to fast scroll', { id: next?.id });
      return;
    }

    // Cancel pending teardown for next
    if (next) {
      const timer = this._releaseTimers.get(next);
      if (timer) {
        clearTimeout(timer);
        this._releaseTimers.delete(next);
      }
    }

    console.debug('warm', next?.id);

    // Release previous warm if different
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
        preloaded: FeedPreloadManager.instance.isPreloaded(next.id) 
      });
    }
  }

  setPaused(handle?: VideoHandle) {
    if (!handle) return;
    
    // Cancel pending teardown
    const timer = this._releaseTimers.get(handle);
    if (timer) {
      clearTimeout(timer);
      this._releaseTimers.delete(handle);
    }
    
    const currentState = this._states.get(handle);
    
    // Only pause if currently Active or Warm
    if (currentState === TileState.Active || currentState === TileState.Warm) {
      try { 
        handle.pause(); 
        if (handle.setPaused) handle.setPaused();
      } catch {}
      
      this._states.set(handle, TileState.Paused);
      this._paused.add(handle);
      
      // Clear from active/warm if it was there
      if (this._active === handle) this._active = undefined;
      if (this._warm === handle) this._warm = undefined;
      
      console.log('[FeedMediaManager] Paused set', { id: handle.id });
    }
  }

  // Deferred teardown for off-screen tiles with grace period
  setIdle(handle?: VideoHandle) {
    if (!handle) return;
    
    // Cancel any existing timer
    const existingTimer = this._releaseTimers.get(handle);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule deferred teardown with grace period
    const timer = window.setTimeout(() => {
      // Double-check if handle was re-promoted during grace period
      const currentState = this._states.get(handle);
      if (currentState === TileState.Active || currentState === TileState.Warm) {
        console.log('[FeedMediaManager] Idle teardown cancelled - handle was re-promoted', { id: handle.id });
        return;
      }
      
      try { 
        handle.pause(); 
        handle.release(); 
      } catch {}
      
      this._states.set(handle, TileState.Idle);
      this._paused.delete(handle);
      if (this._active === handle) this._active = undefined;
      if (this._warm === handle) this._warm = undefined;
      this._releaseTimers.delete(handle);
      
      console.log('[FeedMediaManager] Idle teardown completed', { id: handle.id });
    }, IDLE_RELEASE_GRACE_MS);
    
    this._releaseTimers.set(handle, timer);
    console.log('[FeedMediaManager] Idle teardown scheduled', { id: handle.id, graceMs: IDLE_RELEASE_GRACE_MS });
  }

  clearAll() {
    // Clear all timers by iterating through handles
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
  }
}

export default FeedMediaManager;
