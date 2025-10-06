// Global chunk loading error handler with aggressive cache clearing
export class ChunkErrorHandler {
  private static instance: ChunkErrorHandler;
  private retryCount = 0;
  private maxRetries = 1; // Single retry for immediate recovery
  private retryDelay = 100; // Very fast retry
  private isHandling = false;
  private lastErrorTime = 0;
  private errorCooldown = 5000; // 5 second cooldown between error handling

  static getInstance(): ChunkErrorHandler {
    if (!ChunkErrorHandler.instance) {
      ChunkErrorHandler.instance = new ChunkErrorHandler();
    }
    return ChunkErrorHandler.instance;
  }

  async handleChunkError(error: Error, chunkId?: string): Promise<void> {
    const now = Date.now();
    
    // Check cooldown to prevent rapid-fire error handling
    if (now - this.lastErrorTime < this.errorCooldown) {
      console.warn(`[ChunkErrorHandler] Error handling on cooldown, skipping...`);
      return;
    }
    
    if (this.isHandling) {
      console.warn(`[ChunkErrorHandler] Already handling chunk error, skipping...`);
      return;
    }

    this.isHandling = true;
    this.lastErrorTime = now;
    console.warn(`[ChunkErrorHandler] Chunk loading failed:`, error.message, chunkId ? `(chunk: ${chunkId})` : '');
    
    try {
      // Immediate aggressive cache clearing
      await this.clearAllCaches();
      
      // For chunk errors, be more aggressive - force immediate reload
      console.error(`[ChunkErrorHandler] Chunk error detected. Forcing immediate hard reload...`);
      this.retryCount = 0;
      this.isHandling = false;
      
      // Force a hard reload with cache bypass immediately
      const url = new URL(window.location.href);
      url.searchParams.set('_chunk_reload', Date.now().toString());
      url.searchParams.set('_cache_bust', Math.random().toString(36).substring(2));
      url.searchParams.set('_force_http1', 'true');
      url.searchParams.set('_disable_http2', 'true');
      window.location.href = url.toString();
      
    } catch (clearError) {
      console.error(`[ChunkErrorHandler] Error clearing caches:`, clearError);
      this.isHandling = false;
      // Force reload even if cache clearing fails
      const url = new URL(window.location.href);
      url.searchParams.set('_emergency_reload', Date.now().toString());
      url.searchParams.set('_force_http1', 'true');
      window.location.href = url.toString();
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
