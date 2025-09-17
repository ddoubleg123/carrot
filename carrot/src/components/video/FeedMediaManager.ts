export type VideoHandle = {
  id: string;
  el?: Element; // associated DOM element for identification
  play: () => Promise<void> | void;
  pause: () => void;
  warm: () => Promise<void> | void; // attach media, load playlist + first segment
  setPaused: () => void; // pause but keep attached, show poster
  release: () => void; // detach media/destroy hls, free decoder
};

enum TileState {
  Idle = 'idle',
  Warm = 'warm', 
  Paused = 'paused',
  Active = 'active'
}

// Track scroll velocity (screens/sec) for fast-scroll guard
let lastScrollY = 0;
let lastTime = 0;
let scrollVelocity = 0; // in screens per second

if (typeof window !== 'undefined') {
  lastScrollY = window.scrollY;
  lastTime = performance.now();
  
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = (now - lastTime) / 1000; // seconds
    const screenHeight = window.innerHeight;

    if (dt > 0) {
      scrollVelocity = (dy / screenHeight) / dt;
    }

    lastScrollY = window.scrollY;
    lastTime = now;
  }, { passive: true });
}

const FAST_SCROLL_THRESHOLD = 1.5; // screens per second

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
  private _states = new WeakMap<VideoHandle, TileState>();

  get active() { return this._active; }
  get warm() { return this._warm; }

  registerHandle(el: Element, handle: VideoHandle) {
    handle.el = el;
    this._handles.set(el, handle);
    this._states.set(handle, TileState.Idle);
  }
  
  unregisterHandle(el: Element) {
    const handle = this._handles.get(el);
    if (handle) {
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
    }
  }

  setWarm(next?: VideoHandle) {
    if (scrollVelocity > FAST_SCROLL_THRESHOLD) {
      console.debug('[FeedMediaManager] Skipping Warm due to fast scroll', { velocity: scrollVelocity });
      return; // bail out, no Warm during fast scroll
    }
    
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
      try { void next.warm(); } catch {}
    }
  }

  setPaused(handle?: VideoHandle) {
    if (!handle) return;
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
    }
  }

  // Full teardown for off-screen tiles
  setIdle(handle?: VideoHandle) {
    if (!handle) return;
    try { 
      handle.pause(); 
      handle.release(); 
    } catch {}
    
    this._states.set(handle, TileState.Idle);
    this._paused.delete(handle);
    if (this._active === handle) this._active = undefined;
    if (this._warm === handle) this._warm = undefined;
  }

  clearAll() {
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
  }
}

export default FeedMediaManager;
