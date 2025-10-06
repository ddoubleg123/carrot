// Global chunk loading error handler
export class ChunkErrorHandler {
  private static instance: ChunkErrorHandler;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second

  static getInstance(): ChunkErrorHandler {
    if (!ChunkErrorHandler.instance) {
      ChunkErrorHandler.instance = new ChunkErrorHandler();
    }
    return ChunkErrorHandler.instance;
  }

  handleChunkError(error: Error, chunkId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.warn(`[ChunkErrorHandler] Chunk loading failed:`, error.message, chunkId ? `(chunk: ${chunkId})` : '');
      
      if (this.retryCount >= this.maxRetries) {
        console.error(`[ChunkErrorHandler] Max retries reached. Reloading page...`);
        this.retryCount = 0;
        window.location.reload();
        return;
      }

      this.retryCount++;
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff
      
      console.log(`[ChunkErrorHandler] Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        // Clear the failed chunk from cache
        if (chunkId && 'caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.open(cacheName).then(cache => {
                cache.delete(`/_next/static/chunks/${chunkId}`);
              });
            });
          });
        }
        
        // Try to reload the page
        window.location.reload();
        resolve();
      }, delay);
    });
  }

  reset() {
    this.retryCount = 0;
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
