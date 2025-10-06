// Global chunk loading error handler with aggressive cache clearing
export class ChunkErrorHandler {
  private static instance: ChunkErrorHandler;
  private retryCount = 0;
  private maxRetries = 2; // Reduced retries for faster recovery
  private retryDelay = 500; // Faster initial retry
  private isHandling = false;

  static getInstance(): ChunkErrorHandler {
    if (!ChunkErrorHandler.instance) {
      ChunkErrorHandler.instance = new ChunkErrorHandler();
    }
    return ChunkErrorHandler.instance;
  }

  async handleChunkError(error: Error, chunkId?: string): Promise<void> {
    if (this.isHandling) {
      console.warn(`[ChunkErrorHandler] Already handling chunk error, skipping...`);
      return;
    }

    this.isHandling = true;
    console.warn(`[ChunkErrorHandler] Chunk loading failed:`, error.message, chunkId ? `(chunk: ${chunkId})` : '');
    
    try {
      // Aggressive cache clearing
      await this.clearAllCaches();
      
      if (this.retryCount >= this.maxRetries) {
        console.error(`[ChunkErrorHandler] Max retries reached. Forcing hard reload...`);
        this.retryCount = 0;
        this.isHandling = false;
        // Force a hard reload with cache bypass
        window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + '_t=' + Date.now();
        return;
      }

      this.retryCount++;
      const delay = this.retryDelay * Math.pow(1.5, this.retryCount - 1); // Gentler backoff
      
      console.log(`[ChunkErrorHandler] Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.isHandling = false;
        // Try to reload the page
        window.location.reload();
      }, delay);
    } catch (clearError) {
      console.error(`[ChunkErrorHandler] Error clearing caches:`, clearError);
      this.isHandling = false;
      // Force reload even if cache clearing fails
      window.location.reload();
    }
  }

  private async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      console.warn(`[ChunkErrorHandler] Cache API not available`);
      return;
    }

    try {
      const cacheNames = await caches.keys();
      console.log(`[ChunkErrorHandler] Clearing ${cacheNames.length} caches...`);
      
      // Clear all caches aggressively
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          console.log(`[ChunkErrorHandler] Clearing ${keys.length} entries from cache: ${cacheName}`);
          
          // Delete all entries
          await Promise.all(keys.map(key => cache.delete(key)));
        })
      );

      // Also try to clear service worker caches
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
      }

      console.log(`[ChunkErrorHandler] Cache clearing completed`);
    } catch (error) {
      console.error(`[ChunkErrorHandler] Error during cache clearing:`, error);
    }
  }

  reset() {
    this.retryCount = 0;
    this.isHandling = false;
  }
}

// Global error handler for unhandled chunk loading errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('Loading chunk')) {
      const chunkErrorHandler = ChunkErrorHandler.getInstance();
      chunkErrorHandler.handleChunkError(event.error);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('Loading chunk')) {
      const chunkErrorHandler = ChunkErrorHandler.getInstance();
      chunkErrorHandler.handleChunkError(event.reason);
    }
  });
}
