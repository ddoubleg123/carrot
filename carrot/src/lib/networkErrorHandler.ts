/**
 * Network Error Handler for handling various network-related errors
 */

export interface NetworkError {
  type: 'HTTP2_PROTOCOL_ERROR' | 'CONNECTION_CLOSED' | 'CHUNK_LOAD_ERROR' | 'CORS_ERROR' | 'VIDEO_ERROR' | 'UNKNOWN';
  message: string;
  originalError: Error;
  url?: string;
  retryable: boolean;
  timestamp: string;
  userAgent?: string;
  context?: Record<string, any>;
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
  public analyzeError(error: Error, url?: string, context?: Record<string, any>): NetworkError {
    const message = error.message.toLowerCase();
    const timestamp = new Date().toISOString();
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined;
    
    if (message.includes('err_http2_protocol_error') || message.includes('http2 protocol error') || message.includes('http/2')) {
      return {
        type: 'HTTP2_PROTOCOL_ERROR',
        message: 'HTTP/2 protocol error detected - forcing HTTP/1.1 retry',
        originalError: error,
        url,
        retryable: true,
        timestamp,
        userAgent,
        context: {
          ...context,
          errorCode: 'HTTP2_PROTOCOL_ERROR',
          suggestedAction: 'Force HTTP/1.1 and retry'
        }
      };
    }
    
    if (message.includes('err_connection_closed') || message.includes('connection closed') || message.includes('connection reset')) {
      return {
        type: 'CONNECTION_CLOSED',
        message: 'Connection closed unexpectedly - network instability detected',
        originalError: error,
        url,
        retryable: true,
        timestamp,
        userAgent,
        context: {
          ...context,
          errorCode: 'CONNECTION_CLOSED',
          suggestedAction: 'Retry with connection pool recovery'
        }
      };
    }
    
    if (message.includes('chunkloaderror') || message.includes('loading chunk') || message.includes('invalid or unexpected token')) {
      return {
        type: 'CHUNK_LOAD_ERROR',
        message: 'JavaScript chunk loading failed - asset corruption or network issue',
        originalError: error,
        url,
        retryable: true,
        timestamp,
        userAgent,
        context: {
          ...context,
          errorCode: 'CHUNK_LOAD_ERROR',
          suggestedAction: 'Clear cache and retry'
        }
      };
    }
    
    if (message.includes('cors') || message.includes('access-control')) {
      return {
        type: 'CORS_ERROR',
        message: 'CORS policy violation - cross-origin request blocked',
        originalError: error,
        url,
        retryable: false,
        timestamp,
        userAgent,
        context: {
          ...context,
          errorCode: 'CORS_ERROR',
          suggestedAction: 'Check CORS configuration'
        }
      };
    }
    
    if (message.includes('media_element_error') || message.includes('notsupportederror') || message.includes('video error')) {
      return {
        type: 'VIDEO_ERROR',
        message: 'Video playback error - format or codec issue',
        originalError: error,
        url,
        retryable: true,
        timestamp,
        userAgent,
        context: {
          ...context,
          errorCode: 'VIDEO_ERROR',
          suggestedAction: 'Check video format and codec support'
        }
      };
    }
    
    return {
      type: 'UNKNOWN',
      message: 'Unknown network error - requires investigation',
      originalError: error,
      url,
      retryable: true,
      timestamp,
      userAgent,
      context: {
        ...context,
        errorCode: 'UNKNOWN',
        suggestedAction: 'Manual investigation required'
      }
    };
  }

  /**
   * Handle a network error with appropriate recovery strategies
   */
  public async handleError(networkError: NetworkError): Promise<boolean> {
    const errorKey = networkError.url || networkError.type;
    const currentRetries = this.retryCounts.get(errorKey) || 0;
    
    // Enhanced logging with detailed error information
    console.warn(`[NetworkErrorHandler] Handling ${networkError.type}:`, {
      message: networkError.message,
      url: networkError.url,
      retryable: networkError.retryable,
      currentRetries,
      maxRetries: this.maxRetries,
      timestamp: networkError.timestamp,
      userAgent: networkError.userAgent,
      context: networkError.context,
      originalError: {
        name: networkError.originalError.name,
        message: networkError.originalError.message,
        stack: networkError.originalError.stack?.split('\n').slice(0, 5) // First 5 lines of stack
      }
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
    
    // Force a hard reload with cache bypass immediately - no delay for HTTP/2 errors
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('_http2_reload', Date.now().toString());
      url.searchParams.set('_force_http1', 'true');
      window.location.href = url.toString();
    }
    
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
    
    // Force a hard reload with cache bypass immediately - no delay for chunk errors
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('_chunk_reload', Date.now().toString());
      url.searchParams.set('_cache_bust', Math.random().toString(36).substring(2));
      window.location.href = url.toString();
    }
    
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
