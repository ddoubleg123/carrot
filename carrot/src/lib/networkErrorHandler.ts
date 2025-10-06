/**
 * Network Error Handler for handling various network-related errors
 */

export interface NetworkError {
  type: 'HTTP2_PROTOCOL_ERROR' | 'CONNECTION_CLOSED' | 'CHUNK_LOAD_ERROR' | 'CORS_ERROR' | 'UNKNOWN';
  message: string;
  originalError: Error;
  url?: string;
  retryable: boolean;
}

export class NetworkErrorHandler {
  private static instance: NetworkErrorHandler;
  private retryCounts: Map<string, number> = new Map();
  private maxRetries = 3;

  private constructor() {}

  public static getInstance(): NetworkErrorHandler {
    if (!NetworkErrorHandler.instance) {
      NetworkErrorHandler.instance = new NetworkErrorHandler();
    }
    return NetworkErrorHandler.instance;
  }

  /**
   * Analyze an error and determine its type and retryability
   */
  public analyzeError(error: Error, url?: string): NetworkError {
    const message = error.message.toLowerCase();
    
    if (message.includes('err_http2_protocol_error') || message.includes('http2 protocol error')) {
      return {
        type: 'HTTP2_PROTOCOL_ERROR',
        message: 'HTTP/2 protocol error detected',
        originalError: error,
        url,
        retryable: true
      };
    }
    
    if (message.includes('err_connection_closed') || message.includes('connection closed')) {
      return {
        type: 'CONNECTION_CLOSED',
        message: 'Connection closed unexpectedly',
        originalError: error,
        url,
        retryable: true
      };
    }
    
    if (message.includes('chunkloaderror') || message.includes('loading chunk')) {
      return {
        type: 'CHUNK_LOAD_ERROR',
        message: 'JavaScript chunk loading failed',
        originalError: error,
        url,
        retryable: true
      };
    }
    
    if (message.includes('cors') || message.includes('access-control')) {
      return {
        type: 'CORS_ERROR',
        message: 'CORS policy violation',
        originalError: error,
        url,
        retryable: false
      };
    }
    
    return {
      type: 'UNKNOWN',
      message: 'Unknown network error',
      originalError: error,
      url,
      retryable: true
    };
  }

  /**
   * Handle a network error with appropriate recovery strategies
   */
  public async handleError(networkError: NetworkError): Promise<boolean> {
    const errorKey = networkError.url || networkError.type;
    const currentRetries = this.retryCounts.get(errorKey) || 0;
    
    console.warn(`[NetworkErrorHandler] Handling ${networkError.type}:`, {
      message: networkError.message,
      url: networkError.url,
      retryable: networkError.retryable,
      currentRetries,
      maxRetries: this.maxRetries
    });

    if (!networkError.retryable) {
      console.error(`[NetworkErrorHandler] Non-retryable error: ${networkError.type}`);
      return false;
    }

    if (currentRetries >= this.maxRetries) {
      console.error(`[NetworkErrorHandler] Max retries exceeded for ${networkError.type}`);
      this.retryCounts.delete(errorKey);
      return false;
    }

    // Increment retry count
    this.retryCounts.set(errorKey, currentRetries + 1);

    // Apply specific recovery strategies based on error type
    switch (networkError.type) {
      case 'HTTP2_PROTOCOL_ERROR':
        return this.handleHTTP2Error(networkError);
      
      case 'CONNECTION_CLOSED':
        return this.handleConnectionClosedError(networkError);
      
      case 'CHUNK_LOAD_ERROR':
        return this.handleChunkLoadError(networkError);
      
      default:
        return this.handleGenericError(networkError);
    }
  }

  private async handleHTTP2Error(networkError: NetworkError): Promise<boolean> {
    console.log('[NetworkErrorHandler] Applying aggressive HTTP/2 error recovery...');
    
    // Clear any cached connections aggressively
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[NetworkErrorHandler] Cleared browser caches');
      } catch (error) {
        console.warn('[NetworkErrorHandler] Failed to clear caches:', error);
      }
    }
    
    // Clear service worker caches
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
      } catch (error) {
        console.warn('[NetworkErrorHandler] Failed to clear service worker caches:', error);
      }
    }
    
    // Force a hard reload with cache bypass immediately
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('_reload', Date.now().toString());
        window.location.href = url.toString();
      }
    }, 500); // Faster reload
    
    return true;
  }

  private async handleConnectionClosedError(networkError: NetworkError): Promise<boolean> {
    console.log('[NetworkErrorHandler] Applying connection closed error recovery...');
    
    // Wait for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }

  private async handleChunkLoadError(networkError: NetworkError): Promise<boolean> {
    console.log('[NetworkErrorHandler] Applying aggressive chunk load error recovery...');
    
    // Clear ALL caches, not just chunks
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[NetworkErrorHandler] Cleared all browser caches for chunk error');
      } catch (error) {
        console.warn('[NetworkErrorHandler] Failed to clear caches:', error);
      }
    }
    
    // Clear service worker caches
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
      } catch (error) {
        console.warn('[NetworkErrorHandler] Failed to clear service worker caches:', error);
      }
    }
    
    // Force a hard reload with cache bypass immediately
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('_reload', Date.now().toString());
        window.location.href = url.toString();
      }
    }, 300); // Even faster reload for chunk errors
    
    return true;
  }

  private async handleGenericError(networkError: NetworkError): Promise<boolean> {
    console.log('[NetworkErrorHandler] Applying generic error recovery...');
    
    // Simple retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.retryCounts.get(networkError.url || networkError.type) || 0), 8000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return true;
  }

  /**
   * Reset retry counts for a specific error
   */
  public resetRetryCount(errorKey: string): void {
    this.retryCounts.delete(errorKey);
  }

  /**
   * Clear all retry counts
   */
  public clearAllRetryCounts(): void {
    this.retryCounts.clear();
  }
}

/**
 * Global error handler for unhandled network errors
 */
export function setupGlobalNetworkErrorHandler(): void {
  if (typeof window === 'undefined') return;

  const handler = NetworkErrorHandler.getInstance();

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', async (event) => {
    const error = event.reason;
    if (error instanceof Error) {
      const networkError = handler.analyzeError(error);
      if (networkError.retryable) {
        const handled = await handler.handleError(networkError);
        if (handled) {
          event.preventDefault();
        }
      }
    }
  });

  // Handle general errors
  window.addEventListener('error', async (event) => {
    const error = event.error;
    if (error instanceof Error) {
      const networkError = handler.analyzeError(error);
      if (networkError.retryable) {
        const handled = await handler.handleError(networkError);
        if (handled) {
          event.preventDefault();
        }
      }
    }
  });

  console.log('[NetworkErrorHandler] Global error handler initialized');
}
