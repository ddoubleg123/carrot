/**
 * Handle Render cold-start delays with progressive timeout strategies
 */

interface ColdStartConfig {
  maxRetries: number;
  baseTimeout: number;
  maxTimeout: number;
  backoffMultiplier: number;
}

class RenderColdStartHandler {
  private static instance: RenderColdStartHandler;
  private coldStartConfig: ColdStartConfig = {
    maxRetries: 3,
    baseTimeout: 5000,  // 5 seconds for first attempt
    maxTimeout: 15000,  // 15 seconds max
    backoffMultiplier: 1.5
  };

  private retryCounts = new Map<string, number>();
  private lastAttempts = new Map<string, number>();

  static getInstance(): RenderColdStartHandler {
    if (!RenderColdStartHandler.instance) {
      RenderColdStartHandler.instance = new RenderColdStartHandler();
    }
    return RenderColdStartHandler.instance;
  }

  /**
   * Check if we should retry a failed request due to potential cold start
   */
  shouldRetry(url: string, error: Error): boolean {
    const retryCount = this.retryCounts.get(url) || 0;
    const lastAttempt = this.lastAttempts.get(url) || 0;
    const now = Date.now();

    // Don't retry too frequently (minimum 1 second between attempts)
    if (now - lastAttempt < 1000) {
      return false;
    }

    // Check if this looks like a cold start error
    const isColdStartError = 
      error.message.includes('ERR_CONNECTION_CLOSED') ||
      error.message.includes('ERR_HTTP_PROTOCOL_ERROR') ||
      error.message.includes('fetch failed') ||
      error.message.includes('NetworkError') ||
      error.message.includes('timeout');

    return isColdStartError && retryCount < this.coldStartConfig.maxRetries;
  }

  /**
   * Get the timeout duration for the next retry attempt
   */
  getRetryTimeout(url: string): number {
    const retryCount = this.retryCounts.get(url) || 0;
    const timeout = Math.min(
      this.coldStartConfig.baseTimeout * Math.pow(this.coldStartConfig.backoffMultiplier, retryCount),
      this.coldStartConfig.maxTimeout
    );
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 1000; // 0-1 second jitter
    return Math.round(timeout + jitter);
  }

  /**
   * Record a retry attempt
   */
  recordRetryAttempt(url: string): void {
    const currentCount = this.retryCounts.get(url) || 0;
    this.retryCounts.set(url, currentCount + 1);
    this.lastAttempts.set(url, Date.now());
    
    console.log(`[RenderColdStartHandler] Retry attempt ${currentCount + 1}/${this.coldStartConfig.maxRetries} for ${url.substring(0, 100)}`);
  }

  /**
   * Record a successful request (reset retry count)
   */
  recordSuccess(url: string): void {
    this.retryCounts.delete(url);
    this.lastAttempts.delete(url);
  }

  /**
   * Check if we've exhausted retries for a URL
   */
  hasExhaustedRetries(url: string): boolean {
    const retryCount = this.retryCounts.get(url) || 0;
    return retryCount >= this.coldStartConfig.maxRetries;
  }

  /**
   * Get retry information for debugging
   */
  getRetryInfo(url: string): { retryCount: number; lastAttempt: number; hasExhausted: boolean } {
    const retryCount = this.retryCounts.get(url) || 0;
    const lastAttempt = this.lastAttempts.get(url) || 0;
    return {
      retryCount,
      lastAttempt,
      hasExhausted: this.hasExhaustedRetries(url)
    };
  }

  /**
   * Clean up old retry data to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [url, lastAttempt] of this.lastAttempts) {
      if (now - lastAttempt > maxAge) {
        this.retryCounts.delete(url);
        this.lastAttempts.delete(url);
      }
    }
  }
}

// Clean up old data every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    RenderColdStartHandler.getInstance().cleanup();
  }, 300000);
}

export default RenderColdStartHandler.getInstance();
