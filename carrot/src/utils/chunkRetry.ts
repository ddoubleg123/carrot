// Chunk retry utility for handling chunk loading failures
export class ChunkRetryManager {
  private static instance: ChunkRetryManager;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  static getInstance(): ChunkRetryManager {
    if (!ChunkRetryManager.instance) {
      ChunkRetryManager.instance = new ChunkRetryManager();
    }
    return ChunkRetryManager.instance;
  }

  // Handle chunk loading errors
  handleChunkError(error: Error): boolean {
    if (this.isChunkError(error) && this.retryCount < this.maxRetries) {
      console.log(`Chunk loading error detected, retrying (${this.retryCount + 1}/${this.maxRetries})`);
      
      this.retryCount++;
      
      setTimeout(() => {
        // Try to reload the specific chunk
        this.reloadChunk();
      }, this.retryDelay * this.retryCount);
      
      return true; // Error handled
    }
    
    return false; // Error not handled
  }

  // Check if error is a chunk loading error
  private isChunkError(error: Error): boolean {
    const chunkErrorPatterns = [
      'Loading chunk',
      'ChunkLoadError',
      'Loading CSS chunk',
      'Loading JS chunk',
      'net::ERR_HTTP2_PROTOCOL_ERROR'
    ];
    
    return chunkErrorPatterns.some(pattern => 
      error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  // Reload the current chunk/page
  private reloadChunk(): void {
    // Clear any cached chunks
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('next') || cacheName.includes('chunk')) {
            caches.delete(cacheName);
          }
        });
      });
    }
    
    // Force reload
    window.location.reload();
  }

  // Reset retry count
  reset(): void {
    this.retryCount = 0;
  }

  // Get current retry count
  getRetryCount(): number {
    return this.retryCount;
  }
}

// Global error handler for chunk loading
export function setupChunkErrorHandler(): void {
  // Handle unhandled promise rejections (chunk loading errors)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error instanceof Error) {
      const retryManager = ChunkRetryManager.getInstance();
      if (retryManager.handleChunkError(error)) {
        event.preventDefault(); // Prevent default error handling
      }
    }
  });

  // Handle regular errors
  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error instanceof Error) {
      const retryManager = ChunkRetryManager.getInstance();
      if (retryManager.handleChunkError(error)) {
        event.preventDefault(); // Prevent default error handling
      }
    }
  });
}

// Initialize the chunk error handler
if (typeof window !== 'undefined') {
  setupChunkErrorHandler();
}
