export type VideoHandle = {
  id: string;
  el?: Element; // associated DOM element for identification
  play: () => Promise<void> | void;
  pause: () => void;
  warm: () => Promise<void> | void; // attach media, load playlist + first segment
  release: () => void; // detach media/destroy hls, free decoder
};

// Singleton controller to ensure at most 1 Active and 1 Warm decoder at a time.
class FeedMediaManager {
  private static _inst: FeedMediaManager | null = null;
  static get inst(): FeedMediaManager {
    if (!this._inst) this._inst = new FeedMediaManager();
    return this._inst!;
  }

  private _active?: VideoHandle;
  private _warm?: VideoHandle;
  private _handles = new WeakMap<Element, VideoHandle>();

  get active() { return this._active; }
  get warm() { return this._warm; }

  registerHandle(el: Element, handle: VideoHandle) {
    handle.el = el;
    this._handles.set(el, handle);
  }
  unregisterHandle(el: Element) {
    this._handles.delete(el);
  }
  getHandleByElement(el: Element): VideoHandle | undefined {
    return this._handles.get(el);
  }

  setActive(next?: VideoHandle) {
    if (this._active && this._active !== next) {
      try { this._active.pause(); } catch {}
      try { this._active.release(); } catch {}
    }
    this._active = next;
    if (next) {
      // If a different tile was warmed, release it
      if (this._warm && this._warm !== next) {
        try { this._warm.release(); } catch {}
        this._warm = undefined;
      }
      try { void next.play(); } catch {}
    }
  }

  setWarm(next?: VideoHandle) {
    if (this._warm && this._warm !== next) {
      try { this._warm.release(); } catch {}
    }
    this._warm = next;
    if (next && (!this._active || this._active !== next)) {
      try { void next.warm(); } catch {}
    }
  }

  // Demote a handle to idle: pause, release, and clear active/warm if it matches
  setIdle(handle?: VideoHandle) {
    if (!handle) return;
    try { handle.pause(); } catch {}
    try { handle.release(); } catch {}
    if (this._active === handle) this._active = undefined;
    if (this._warm === handle) this._warm = undefined;
  }

  clearAll() {
    if (this._active) { try { this._active.pause(); this._active.release(); } catch {} }
    if (this._warm) { try { this._warm.release(); } catch {} }
    this._active = undefined;
    this._warm = undefined;
  }
}

export default FeedMediaManager;
