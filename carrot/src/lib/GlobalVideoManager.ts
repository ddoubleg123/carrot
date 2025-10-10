/**
 * Global Video Manager - Singleton pattern to enforce only one video playing at a time
 * Prevents "play() interrupted by pause()" errors
 */

class GlobalVideoManager {
  private static instance: GlobalVideoManager;
  private currentlyPlayingVideo: HTMLVideoElement | null = null;
  private registeredVideos: Set<HTMLVideoElement> = new Set();

  private constructor() {
    console.log('[GlobalVideoManager] Initialized');
  }

  static getInstance(): GlobalVideoManager {
    if (!GlobalVideoManager.instance) {
      GlobalVideoManager.instance = new GlobalVideoManager();
    }
    return GlobalVideoManager.instance;
  }

  /**
   * Register a video element for management
   */
  register(video: HTMLVideoElement, postId: string): void {
    if (!this.registeredVideos.has(video)) {
      this.registeredVideos.add(video);
      console.log('[GlobalVideoManager] Registered video', { 
        postId, 
        totalVideos: this.registeredVideos.size 
      });
    }
  }

  /**
   * Unregister a video element
   */
  unregister(video: HTMLVideoElement, postId: string): void {
    if (this.registeredVideos.has(video)) {
      this.registeredVideos.delete(video);
      if (this.currentlyPlayingVideo === video) {
        this.currentlyPlayingVideo = null;
      }
      console.log('[GlobalVideoManager] Unregistered video', { 
        postId, 
        totalVideos: this.registeredVideos.size 
      });
    }
  }

  /**
   * Request to play a video - pauses all others first
   */
  async requestPlay(video: HTMLVideoElement, postId: string): Promise<void> {
    // If this video is already the currently playing one, do nothing
    if (this.currentlyPlayingVideo === video && !video.paused) {
      console.log('[GlobalVideoManager] Video already playing', { postId });
      return;
    }

    // Pause all other videos
    await this.pauseAllExcept(video, postId);

    // Set this as the currently playing video
    this.currentlyPlayingVideo = video;

    // Attempt to play
    try {
      // Check if video is ready
      if (video.readyState < 2) {
        console.warn('[GlobalVideoManager] Video not ready, waiting...', {
          postId,
          readyState: video.readyState
        });
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video load timeout'));
          }, 5000);

          const onCanPlay = () => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            reject(new Error('Video load error'));
          };

          video.addEventListener('canplay', onCanPlay, { once: true });
          video.addEventListener('error', onError, { once: true });
        });
      }

      await video.play();
      console.log('[GlobalVideoManager] ✅ Video playing', { 
        postId,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        currentTime: video.currentTime
      });
    } catch (error: any) {
      console.error('[GlobalVideoManager] ❌ Play failed', { 
        postId, 
        error: error.message,
        readyState: video.readyState,
        networkState: video.networkState
      });
      throw error;
    }
  }

  /**
   * Pause all videos except the specified one
   */
  private async pauseAllExcept(exceptVideo: HTMLVideoElement, currentPostId: string): Promise<void> {
    const pausePromises: Promise<void>[] = [];

    for (const video of this.registeredVideos) {
      if (video !== exceptVideo && !video.paused) {
        const postId = video.getAttribute('data-post-id') || 'unknown';
        console.log('[GlobalVideoManager] Pausing video', { postId });
        
        pausePromises.push(
          new Promise((resolve) => {
            try {
              video.pause();
              resolve();
            } catch (e) {
              console.warn('[GlobalVideoManager] Failed to pause video', { postId, error: e });
              resolve();
            }
          })
        );
      }
    }

    await Promise.all(pausePromises);
    console.log('[GlobalVideoManager] All other videos paused', { currentPostId });
  }

  /**
   * Pause the currently playing video
   */
  pauseCurrent(): void {
    if (this.currentlyPlayingVideo && !this.currentlyPlayingVideo.paused) {
      try {
        this.currentlyPlayingVideo.pause();
        console.log('[GlobalVideoManager] Paused current video');
      } catch (e) {
        console.warn('[GlobalVideoManager] Failed to pause current video', e);
      }
      this.currentlyPlayingVideo = null;
    }
  }

  /**
   * Get the currently playing video
   */
  getCurrentlyPlaying(): HTMLVideoElement | null {
    return this.currentlyPlayingVideo;
  }

  /**
   * Check if a video is currently playing
   */
  isVideoPlaying(video: HTMLVideoElement): boolean {
    return this.currentlyPlayingVideo === video && !video.paused;
  }
}

export default GlobalVideoManager.getInstance();
