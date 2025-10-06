/**
 * Retry utility with exponential backoff for handling network errors
 */

import { connectionPool } from './connectionPool';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5, // Increased retries
  baseDelay: 500, // Faster initial retry
  maxDelay: 15000, // Increased max delay
  backoffMultiplier: 1.8, // Gentler backoff
  retryCondition: (error: Error) => {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    // More comprehensive error detection
    return (
      // HTTP/2 and protocol errors
      message.includes('err_http2_protocol_error') ||
      message.includes('err_quic_protocol_error') ||
      message.includes('protocol error') ||
      message.includes('http2') ||
      message.includes('quic') ||
      
      // Connection errors
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('connection closed') ||
      message.includes('connection reset') ||
      message.includes('connection refused') ||
      message.includes('connection aborted') ||
      
      // Network errors
      message.includes('network error') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      message.includes('network request failed') ||
      
      // Timeout errors
      message.includes('timeout') ||
      message.includes('aborted') ||
      
      // Generic errors that might be network-related
      (name === 'typeerror' && message.includes('fetch')) ||
      (name === 'aborterror') ||
      (name === 'networkerror') ||
      
      // Chunk loading errors
      message.includes('loading chunk') ||
      message.includes('chunkloaderror') ||
      
      // DNS and resolution errors
      message.includes('dns') ||
      message.includes('resolve') ||
      message.includes('lookup')
    );
  }
};

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if we've exhausted attempts or if the error shouldn't be retried
      if (attempt === opts.maxRetries || !opts.retryCondition(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const totalDelay = delay + jitter;

      console.warn(`[RetryUtils] Attempt ${attempt + 1} failed, retrying in ${Math.round(totalDelay)}ms:`, {
        error: lastError.message,
        attempt: attempt + 1,
        maxRetries: opts.maxRetries
      });

      await sleep(totalDelay);
    }
  }

  throw lastError!;
}

/**
 * Retry fetch requests with exponential backoff and aggressive HTTP/1.1 forcing
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    // Use connection pool for better HTTP/1.1 management
    const controller = connectionPool.createConnection(url);
    const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased timeout to 45 seconds

    try {
      // Check if this is a Firebase Storage URL - don't send cache-control headers to avoid CORS issues
      const isFirebaseStorage = url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com');
      
      // Force HTTP/1.1 with aggressive headers
      const headers: Record<string, string> = {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Force HTTP/1.1
        'HTTP-Version': '1.1',
        'X-Forwarded-Proto': 'http',
        'X-Forwarded-For': '127.0.0.1',
        // Additional HTTP/1.1 forcing headers
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (compatible; HTTP/1.1)',
        // Merge with existing headers
        ...(options.headers as Record<string, string>),
      };

      // Remove problematic headers for Firebase Storage
      if (isFirebaseStorage) {
        delete headers['Cache-Control'];
        delete headers['Pragma'];
        delete headers['Expires'];
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
        // Force HTTP/1.1 behavior
        credentials: 'same-origin',
        mode: 'cors',
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // Abort the connection on error
      controller.abort();
      throw error;
    }
  }, retryOptions);
}

/**
 * Check if an error is a network protocol error
 */
export function isNetworkProtocolError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('err_http2_protocol_error') ||
    message.includes('err_quic_protocol_error') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('network error') ||
    message.includes('fetch failed') ||
    message.includes('connection closed') ||
    message.includes('protocol error')
  );
}

/**
 * Create a resilient fetch function for API calls
 */
export function createResilientFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    return fetchWithRetry(url, options, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      retryCondition: (error) => {
        // Retry on network errors but not on HTTP status errors
        if (isNetworkProtocolError(error)) {
          return true;
        }
        
        // Don't retry on client errors (4xx) except for specific cases
        if (error.message.includes('HTTP 4')) {
          return false;
        }
        
        // Retry on server errors (5xx) and network issues
        return error.message.includes('HTTP 5') || isNetworkProtocolError(error);
      }
    });
  };
}
