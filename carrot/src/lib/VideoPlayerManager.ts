class VideoPlayerManager {
  private static _inst: VideoPlayerManager | null = null;
  static get inst() {
    if (!this._inst) this._inst = new VideoPlayerManager();
    return this._inst;
  }

  private videoEl: HTMLVideoElement | null = null;
  private currentParent: HTMLElement | null = null;

  // Adopt an existing <video> element created by feed player
  adopt(el: HTMLVideoElement | null) {
    if (!el) return;
    this.videoEl = el;
    try {
      this.videoEl.muted = true; // default safe state for autoplay
      this.videoEl.playsInline = true as any;
    } catch {}
  }

  isReady() {
    return !!this.videoEl;
  }

  mount(target: HTMLElement | null) {
    if (!target || !this.videoEl) return false;
    try {
      if (this.videoEl.parentElement !== target) {
        target.appendChild(this.videoEl);
        this.currentParent = target;
      }
      return true;
    } catch {
      return false;
    }
  }

  unmount(toParent?: HTMLElement | null) {
    if (!this.videoEl) return;
    try {
      if (toParent && this.videoEl.parentElement !== toParent) {
        toParent.appendChild(this.videoEl);
        this.currentParent = toParent;
      }
    } catch {}
  }

  get element() { return this.videoEl; }
  get currentTime() { return this.videoEl?.currentTime ?? 0; }
  set currentTime(t: number) { try { if (this.videoEl) this.videoEl.currentTime = t; } catch {} }
  get muted() { return this.videoEl?.muted ?? true; }
  set muted(v: boolean) { try { if (this.videoEl) this.videoEl.muted = v; } catch {} }
  get paused() { return this.videoEl?.paused ?? true; }

  async play() { try { await this.videoEl?.play(); } catch {} }
  pause() { try { this.videoEl?.pause(); } catch {} }
}

export default VideoPlayerManager;
