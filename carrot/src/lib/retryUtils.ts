/**
 * Retry utility with exponential backoff for handling network errors
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
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
 * Retry fetch requests with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        // Optimize headers for better HTTP/2 compatibility
        headers: {
          ...options.headers,
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
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
