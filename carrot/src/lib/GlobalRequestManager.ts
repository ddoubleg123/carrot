/**
 * Global Request Manager
 * 
 * Prevents browser connection overload by throttling ALL requests across the application.
 * This addresses HTTP 499 errors caused by exceeding browser connection limits.
 */

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

class GlobalRequestManager {
  private static _instance: GlobalRequestManager | null = null;
  
  static get instance(): GlobalRequestManager {
    if (!this._instance) {
      this._instance = new GlobalRequestManager();
    }
    return this._instance;
  }

  private requestQueue: QueuedRequest[] = [];
  private activeRequests = new Set<string>();
  private isProcessing = false;
  
  // Conservative limits to prevent browser connection overload
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Very conservative
  private readonly MAX_REQUESTS_PER_SECOND = 5; // Rate limiting
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  
  private lastRequestTime = 0;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  
  private constructor() {
    // Start processing queue
    this.processQueue();
  }

  /**
   * Make a throttled request
   */
  async request(url: string, options: RequestInit = {}, priority: number = 0): Promise<Response> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      const queuedRequest: QueuedRequest = {
        id: requestId,
        url,
        options,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };
      
      this.requestQueue.push(queuedRequest);
      this.requestQueue.sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority
      
      console.log('[GlobalRequestManager] Queued request', { 
        requestId, 
        url: url.substring(0, 100) + '...', 
        priority,
        queueLength: this.requestQueue.length 
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue with strict throttling
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.requestQueue.length > 0 && this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS) {
        // Check rate limiting
        const now = Date.now();
        if (now - this.requestWindowStart > 1000) {
          // Reset rate limiting window
          this.requestCount = 0;
          this.requestWindowStart = now;
        }
        
        if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
          // Rate limit exceeded, wait
          await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.requestWindowStart)));
          continue;
        }
        
        const request = this.requestQueue.shift();
        if (!request) break;
        
        // Add delay between requests to prevent overwhelming browser
        if (this.lastRequestTime > 0) {
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < 100) { // Minimum 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
          }
        }
        
        this.executeRequest(request);
        this.requestCount++;
        this.lastRequestTime = Date.now();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    const { id, url, options, resolve, reject, retries, maxRetries } = request;
    
    this.activeRequests.add(id);
    
    console.log('[GlobalRequestManager] Executing request', { 
      requestId: id, 
      url: url.substring(0, 100) + '...',
      retries,
      activeRequests: this.activeRequests.size 
    });
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      
      // Add abort signal to options
      const requestOptions: RequestInit = {
        ...options,
        signal: controller.signal
      };
      
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);
      
      if (response.ok) {
        resolve(response);
        console.log('[GlobalRequestManager] Request successful', { 
          requestId: id, 
          status: response.status,
          url: url.substring(0, 100) + '...'
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      const errorObj = error as Error;
      const isAborted = errorObj.name === 'AbortError';
      const isNetworkError = errorObj.message.includes('Failed to fetch') || 
                            errorObj.message.includes('ERR_') ||
                            errorObj.message.includes('499');
      
      console.warn('[GlobalRequestManager] Request failed', { 
        requestId: id, 
        error: errorObj.message,
        isAborted,
        isNetworkError,
        retries,
        maxRetries,
        url: url.substring(0, 100) + '...'
      });
      
      // Retry logic for network errors
      if (isNetworkError && retries < maxRetries) {
        console.log('[GlobalRequestManager] Retrying request', { 
          requestId: id, 
          retries: retries + 1,
          delay: Math.min(1000 * Math.pow(2, retries), 5000) // Exponential backoff, max 5s
        });
        
        // Add to queue for retry with exponential backoff
        setTimeout(() => {
          const retryRequest: QueuedRequest = {
            ...request,
            retries: retries + 1
          };
          this.requestQueue.unshift(retryRequest); // Add to front of queue for retry
          this.processQueue();
        }, Math.min(1000 * Math.pow(2, retries), 5000));
        
        return; // Don't reject yet, we're retrying
      }
      
      reject(errorObj);
    } finally {
      this.activeRequests.delete(id);
      this.processQueue(); // Process next request
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      maxConcurrent: this.MAX_CONCURRENT_REQUESTS,
      maxPerSecond: this.MAX_REQUESTS_PER_SECOND,
      requestCount: this.requestCount,
      windowStart: this.requestWindowStart
    };
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
    console.log('[GlobalRequestManager] Queue cleared');
  }

  /**
   * Clear all retry counts (for diagnostics API compatibility)
   */
  clearAllRetryCounts(): void {
    // GlobalRequestManager doesn't maintain retry counts, but we implement this for compatibility
    console.log('[GlobalRequestManager] Retry counts cleared (GlobalRequestManager doesn\'t maintain retry counts)');
  }
}

export const globalRequestManager = GlobalRequestManager.instance;
export default globalRequestManager;
