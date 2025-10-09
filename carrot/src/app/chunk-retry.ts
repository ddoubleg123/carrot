// Chunk retry logic to handle ChunkLoadError
// This script should be loaded early in the app lifecycle

declare global {
  interface Window {
    __CHUNK_RETRY_COUNT__: Map<string, number>;
    __RETRY_CHUNK__: (chunkId: string) => void;
  }
}

if (typeof window !== 'undefined') {
  // Initialize retry counter
  if (!window.__CHUNK_RETRY_COUNT__) {
    window.__CHUNK_RETRY_COUNT__ = new Map();
  }

  // Retry function for failed chunks
  window.__RETRY_CHUNK__ = (chunkId: string) => {
    const retryCount = window.__CHUNK_RETRY_COUNT__.get(chunkId) || 0;
    const maxRetries = 3;

    console.log(`[ChunkRetry] Attempting to retry chunk ${chunkId} (attempt ${retryCount + 1}/${maxRetries})`);

    if (retryCount < maxRetries) {
      window.__CHUNK_RETRY_COUNT__.set(chunkId, retryCount + 1);
      
      // Add cache-busting parameter and reload
      const timestamp = Date.now();
      console.log(`[ChunkRetry] Reloading with cache-buster: t=${timestamp}`);
      
      // Reload the page to retry chunk loading
      window.location.href = `${window.location.pathname}${window.location.search}${window.location.search ? '&' : '?'}_retry=${timestamp}`;
    } else {
      console.error(`[ChunkRetry] Max retries exceeded for chunk ${chunkId}`);
      // Show user-friendly error
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: white; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 9999; max-width: 300px;">
          <h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">Loading Error</h3>
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">Failed to load page component after ${maxRetries} attempts.</p>
          <button onclick="window.location.reload()" style="width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
            Reload Page
          </button>
        </div>
      `;
      document.body.appendChild(errorDiv);
    }
  };

  // Intercept chunk load errors
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const messageStr = String(message);
    
    // Check if it's a ChunkLoadError
    if (messageStr.includes('ChunkLoadError') || messageStr.includes('Loading chunk')) {
      console.error('[ChunkRetry] ChunkLoadError detected:', { message, source });
      
      // Extract chunk ID from error message
      const chunkMatch = messageStr.match(/chunk[s]?\s+(\d+)/i) || source?.match(/\/(\d+)\./);
      const chunkId = chunkMatch ? chunkMatch[1] : 'unknown';
      
      // Retry the chunk
      window.__RETRY_CHUNK__(chunkId);
      
      // Prevent default error handling
      return true;
    }
    
    // Call original error handler
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    
    return false;
  };

  console.log('[ChunkRetry] Chunk retry system initialized');
}

export {};

