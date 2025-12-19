/**
 * Aggressive HTTP/1.1 forcing fetch wrapper
 * This module provides a fetch implementation that aggressively forces HTTP/1.1
 * to prevent HTTP/2 protocol errors on Render.com
 */

import { connectionPool } from './connectionPool';
import { normalizeUrlWithWWW, generateUrlVariations } from '@/lib/utils/urlNormalization';

interface HTTP1FetchOptions extends RequestInit {
  forceHTTP1?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  tryUrlVariations?: boolean; // Enable URL variation fallback
}

class HTTP1FetchManager {
  private static instance: HTTP1FetchManager;
  private retryCounts: Map<string, number> = new Map();
  private maxRetries = 4; // Increased from 3 to 4
  private baseRetryDelay = 2000; // Increased from 1000ms to 2000ms for slower sites

  static getInstance(): HTTP1FetchManager {
    if (!HTTP1FetchManager.instance) {
      HTTP1FetchManager.instance = new HTTP1FetchManager();
    }
    return HTTP1FetchManager.instance;
  }

  /**
   * Create HTTP/1.1 forcing headers
   */
  private createHTTP1Headers(originalHeaders?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
      // Force HTTP/1.1 with more aggressive settings
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=5, max=1000',
      'HTTP-Version': '1.1',
      'X-Forwarded-Proto': 'http',
      'X-Forwarded-For': '127.0.0.1',
      'X-Forwarded-Host': 'carrot-app.onrender.com',
      'X-Real-IP': '127.0.0.1',
      
      // Disable HTTP/2 features more aggressively
      'Accept-Encoding': 'gzip, deflate', // No brotli to avoid HTTP/2
      'TE': '', // Disable transfer encoding
      'Upgrade': '', // Disable protocol upgrades
      'HTTP2-Settings': '', // Explicitly disable HTTP/2
      'Alt-Svc': '', // Disable alternative services
      
      // Cache control
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      
      // User agent that prefers HTTP/1.1
      'User-Agent': 'Mozilla/5.0 (compatible; HTTP/1.1-Only; CarrotApp/1.0)',
      
      // Additional HTTP/1.1 forcing headers
      'X-HTTP-Version': '1.1',
      'X-Protocol': 'HTTP/1.1',
      'X-Force-HTTP1': 'true',
      'X-Disable-HTTP2': 'true',
      'X-Legacy-HTTP': 'true',
    };

    // Merge with original headers
    if (originalHeaders) {
      if (originalHeaders instanceof Headers) {
        originalHeaders.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(originalHeaders)) {
        originalHeaders.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, originalHeaders);
      }
    }

    return headers;
  }

  /**
   * Check if URL is Firebase Storage (needs special handling)
   */
  private isFirebaseStorage(url: string): boolean {
    return url.includes('firebasestorage.googleapis.com') || 
           url.includes('storage.googleapis.com') ||
           url.includes('.appspot.com');
  }

  /**
   * Create Firebase-safe headers (remove problematic ones)
   */
  private createFirebaseHeaders(originalHeaders?: HeadersInit): Record<string, string> {
    // Start with minimal safe headers for Firebase
    const headers: Record<string, string> = {};
    
    // List of headers that are SAFE for Firebase Storage
    const allowedHeaders = new Set([
      'accept',
      'accept-language',
      'content-type',
      'origin',
      'referer',
      'user-agent',
    ]);

    // Merge with original headers, but only if they're in the allowed list
    if (originalHeaders) {
      if (originalHeaders instanceof Headers) {
        originalHeaders.forEach((value, key) => {
          const lowerKey = key.toLowerCase();
          if (allowedHeaders.has(lowerKey)) {
            headers[key] = value;
          }
        });
      } else if (Array.isArray(originalHeaders)) {
        originalHeaders.forEach(([key, value]) => {
          const lowerKey = key.toLowerCase();
          if (allowedHeaders.has(lowerKey)) {
            headers[key] = value;
          }
        });
      } else {
        Object.entries(originalHeaders).forEach(([key, value]) => {
          const lowerKey = key.toLowerCase();
          if (allowedHeaders.has(lowerKey)) {
            headers[key] = value;
          }
        });
      }
    }

    // Set a standard user agent if not provided
    if (!headers['user-agent'] && !headers['User-Agent']) {
      headers['User-Agent'] = 'Mozilla/5.0 (compatible; CarrotApp/1.0)';
    }

    return headers;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('err_http2_protocol_error') ||
      message.includes('err_connection_closed') ||
      message.includes('connection closed') ||
      message.includes('connection reset') ||
      message.includes('network error') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('loading chunk') ||
      message.includes('chunkloaderror') ||
      message.includes('protocol error') ||
      message.includes('http2') ||
      message.includes('http/2') ||
      message.includes('invalid or unexpected token') ||
      message.includes('syntax error')
    );
  }

  /**
   * Validate and normalize URL
   */
  private validateUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error(`Invalid URL: ${url}`);
    }

    // CRITICAL FIX: Reject data URIs (violates CSP and can't be fetched)
    if (url.startsWith('data:')) {
      throw new Error(`Cannot fetch data URI - CSP violation. Data URIs should be used directly, not fetched.`);
    }

    // Handle relative URLs by making them absolute
    if (url.startsWith('/')) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://carrot-app.onrender.com';
      url = baseUrl + url;
    }

    // Normalize URL (add www if domain requires it)
    url = normalizeUrlWithWWW(url);

    // Validate URL format
    try {
      new URL(url);
      return url;
    } catch (error) {
      throw new Error(`Invalid URL format: ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main fetch method with HTTP/1.1 forcing (no global throttling - removed for simplicity)
   */
  async fetch(url: string, options: HTTP1FetchOptions = {}): Promise<Response> {
    const {
      forceHTTP1 = true,
      maxRetries = this.maxRetries,
      retryDelay = this.baseRetryDelay,
      tryUrlVariations = false,
      ...fetchOptions
    } = options;

    // Validate and normalize URL
    let validatedUrl = this.validateUrl(url);
    const urlKey = new URL(validatedUrl).origin;
    const currentRetries = this.retryCounts.get(urlKey) || 0;

    // Create appropriate headers based on URL
    const headers = this.isFirebaseStorage(validatedUrl) 
      ? this.createFirebaseHeaders(fetchOptions.headers)
      : this.createHTTP1Headers(fetchOptions.headers);

    try {
      // Use native fetch with HTTP/1.1 forcing - no global throttling
      const response = await fetch(validatedUrl, {
        ...fetchOptions,
        headers,
        // Force HTTP/1.1 behavior
        credentials: 'same-origin',
        mode: 'cors',
        redirect: 'follow',
        // Disable HTTP/2 features
        cache: 'no-store',
        // Additional HTTP/1.1 forcing options
        keepalive: true,
        referrerPolicy: 'strict-origin-when-cross-origin', // Changed from 'no-referrer' to avoid validation error
        // Additional options to force HTTP/1.1
        integrity: undefined, // Disable integrity checks that might force HTTP/2
        priority: 'low', // Lower priority to avoid HTTP/2 optimizations
      });

      // Reset retry count on success
      this.retryCounts.delete(urlKey);
      
      return response;
    } catch (error) {
      const err = error as Error;
      console.warn(`[HTTP1Fetch] Request failed (attempt ${currentRetries + 1}/${maxRetries + 1}):`, {
        url,
        error: err.message,
        isRetryable: this.isRetryableError(err)
      });

      // Check if we should retry
      if (currentRetries < maxRetries && this.isRetryableError(err)) {
        this.retryCounts.set(urlKey, currentRetries + 1);
        
        // If URL variations are enabled, try variations before retrying original
        if (tryUrlVariations && currentRetries === 1) {
          const variations = generateUrlVariations(validatedUrl);
          console.log(`[HTTP1Fetch] Trying URL variations (${variations.length} total)...`);
          
          for (const variation of variations.slice(1)) { // Skip first (already tried)
            try {
              const testUrl = this.validateUrl(variation);
              const testHeaders = this.isFirebaseStorage(testUrl) 
                ? this.createFirebaseHeaders(fetchOptions.headers)
                : this.createHTTP1Headers(fetchOptions.headers);
              
              const testResponse = await fetch(testUrl, {
                ...fetchOptions,
                headers: testHeaders,
                credentials: 'same-origin',
                mode: 'cors',
                redirect: 'follow',
                cache: 'no-store',
                keepalive: true,
                referrerPolicy: 'no-referrer',
                integrity: undefined,
                priority: 'low',
              });
              
              if (testResponse.ok) {
                console.log(`[HTTP1Fetch] ✅ URL variation succeeded: ${variation}`);
                this.retryCounts.delete(urlKey);
                return testResponse;
              }
            } catch (variationError) {
              // Continue to next variation
              continue;
            }
          }
        }
        
        // Handle connection failures through connection pool
        const connectionHandled = await connectionPool.handleConnectionFailure(validatedUrl, err);
        
        // For HTTP/2 errors, use more aggressive retry strategy
        const isHTTP2Error = err.message.toLowerCase().includes('http2') || 
                            err.message.toLowerCase().includes('protocol error');
        const isConnectionError = err.message.toLowerCase().includes('connection closed') ||
                                 err.message.toLowerCase().includes('connection reset');
        
        const baseDelay = isHTTP2Error ? retryDelay * 2 : (isConnectionError ? retryDelay * 1.5 : retryDelay);
        const delay = baseDelay * Math.pow(2, currentRetries) + Math.random() * 1000;
        
        console.log(`[HTTP1Fetch] Retrying in ${Math.round(delay)}ms...`, 
          isHTTP2Error ? '(HTTP/2 error - using aggressive retry)' : 
          isConnectionError ? '(Connection error - using connection pool recovery)' : '');
        
        await this.sleep(delay);
        
        // For HTTP/2 errors, add even more aggressive headers on retry
        if (isHTTP2Error) {
          const enhancedOptions = {
            ...options,
            headers: {
              ...options.headers,
              'X-Retry-Attempt': (currentRetries + 1).toString(),
              'X-Force-HTTP1-Retry': 'true',
              'X-Disable-HTTP2': 'true',
              'X-HTTP1-Only': 'true',
              'X-Legacy-Protocol': 'true',
              'X-No-HTTP2': 'true',
            }
          };
          return this.fetch(url, enhancedOptions);
        }
        
        return this.fetch(url, options);
      }

      // Max retries exceeded or non-retryable error
      this.retryCounts.delete(urlKey);
      throw err;
    }
  }

  /**
   * Reset retry counts
   */
  resetRetryCounts(): void {
    this.retryCounts.clear();
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.retryCounts.forEach((count, url) => {
      stats[url] = count;
    });
    return stats;
  }
}

// Create singleton instance
const http1FetchManager = HTTP1FetchManager.getInstance();

/**
 * HTTP/1.1 forcing fetch function
 */
export async function http1Fetch(url: string, options: HTTP1FetchOptions = {}): Promise<Response> {
  return http1FetchManager.fetch(url, options);
}

/**
 * Create a resilient fetch function that forces HTTP/1.1
 */
export function createHTTP1Fetch() {
  return (url: string, options: RequestInit = {}) => http1Fetch(url, options);
}

/**
 * Reset retry counts
 */
export function resetHTTP1RetryCounts(): void {
  http1FetchManager.resetRetryCounts();
}

/**
 * Get retry statistics
 */
export function getHTTP1RetryStats(): Record<string, number> {
  return http1FetchManager.getRetryStats();
}

// Export the manager for advanced usage
export { http1FetchManager };
