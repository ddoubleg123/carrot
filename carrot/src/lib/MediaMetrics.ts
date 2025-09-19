export interface PosterMetric {
  postId: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  loadTime?: number;
  error?: string;
  url: string;
  fromCache: boolean;
}

export interface TTFFMetric {
  postId: string;
  startTime: number;
  firstFrameTime?: number;
  ttff?: number;
  preloaded: boolean;
  error?: string;
}

export interface CacheMetric {
  type: 'poster' | 'video' | 'image' | 'audio';
  hit: boolean;
  size?: number;
  timestamp: number;
}

export interface ErrorMetric {
  type: 'ExpiredToken' | 'NetworkError' | 'VideoError' | 'PosterError';
  postId?: string;
  url?: string;
  message: string;
  timestamp: number;
  stack?: string;
}

export interface MemoryMetric {
  preloadQueueMB: number;
  stateCacheMB: number;
  totalMB: number;
  timestamp: number;
}

export interface MetricsSummary {
  posterStats: {
    total: number;
    within200ms: number;
    averageLoadTime: number;
    successRate: number;
  };
  ttffStats: {
    total: number;
    p50: number;
    p75: number;
    p95: number;
    averageTTFF: number;
  };
  cacheStats: {
    posterHitRate: number;
    videoHitRate: number;
    totalHits: number;
    totalRequests: number;
  };
  errorStats: {
    expiredTokenCount: number;
    totalErrors: number;
    errorRate: number;
  };
  memoryStats: {
    averageUsageMB: number;
    peakUsageMB: number;
    currentUsageMB: number;
  };
}

// Singleton MediaMetrics for centralized tracking
class MediaMetrics {
  private static _instance: MediaMetrics | null = null;
  
  static get instance(): MediaMetrics {
    if (!this._instance) {
      this._instance = new MediaMetrics();
    }
    return this._instance;
  }

  private posterMetrics: PosterMetric[] = [];
  private ttffMetrics: TTFFMetric[] = [];
  private cacheMetrics: CacheMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private memoryMetrics: MemoryMetric[] = [];
  
  // Alert thresholds
  private readonly ALERTS = {
    POSTER_200MS_THRESHOLD: 0.8, // 80% should load within 200ms
    TTFF_P75_THRESHOLD: 800, // P75 should be under 800ms
    ERROR_RATE_THRESHOLD: 0.05, // 5% error rate max
    MEMORY_THRESHOLD_MB: 200, // Alert if over 200MB total
  };

  // Track poster loading
  startPosterLoad(postId: string, url: string): string {
    const metricId = `poster-${postId}-${Date.now()}`;
    this.posterMetrics.push({
      postId,
      startTime: performance.now(),
      success: false,
      url,
      fromCache: false
    });
    return metricId;
  }

  endPosterLoad(postId: string, success: boolean, fromCache = false, error?: string): void {
    const metric = this.posterMetrics.find(m => 
      m.postId === postId && !m.endTime
    );
    
    if (metric) {
      const endTime = performance.now();
      metric.endTime = endTime;
      metric.loadTime = endTime - metric.startTime;
      metric.success = success;
      metric.fromCache = fromCache;
      metric.error = error;

      // Check for poster load alert
      if (metric.loadTime > 200 && !fromCache) {
        console.warn('[MediaMetrics] Slow poster load', {
          postId,
          loadTime: Math.round(metric.loadTime),
          url: metric.url
        });
      }

      console.log('[MediaMetrics] Poster load completed', {
        postId,
        loadTime: Math.round(metric.loadTime || 0),
        success,
        fromCache
      });
    }
  }

  // Track Time To First Frame
  startTTFF(postId: string, preloaded: boolean): void {
    this.ttffMetrics.push({
      postId,
      startTime: performance.now(),
      preloaded
    });
  }

  endTTFF(postId: string, success = true, error?: string): void {
    const metric = this.ttffMetrics.find(m => 
      m.postId === postId && !m.firstFrameTime
    );
    
    if (metric) {
      const firstFrameTime = performance.now();
      metric.firstFrameTime = firstFrameTime;
      metric.ttff = firstFrameTime - metric.startTime;
      metric.error = error;

      console.log('[MediaMetrics] TTFF recorded', {
        postId,
        ttff: Math.round(metric.ttff),
        preloaded: metric.preloaded
      });
    }
  }

  // Track cache hits/misses
  recordCacheHit(type: CacheMetric['type'], hit: boolean, size?: number): void {
    this.cacheMetrics.push({
      type,
      hit,
      size,
      timestamp: Date.now()
    });
  }

  // Track errors
  recordError(type: ErrorMetric['type'], message: string, postId?: string, url?: string): void {
    const error: ErrorMetric = {
      type,
      message,
      postId,
      url,
      timestamp: Date.now(),
      stack: new Error().stack
    };
    
    this.errorMetrics.push(error);
    
    // Alert for ExpiredToken errors
    if (type === 'ExpiredToken') {
      console.error('[MediaMetrics] ALERT: ExpiredToken error detected', {
        postId,
        url,
        message
      });
      
      // In production, send to error tracking service
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: `ExpiredToken: ${message}`,
          fatal: false
        });
      }
    }
    
    console.warn('[MediaMetrics] Error recorded', { type, message, postId });
  }

  // Track memory usage
  recordMemoryUsage(preloadQueueMB: number, stateCacheMB: number): void {
    const totalMB = preloadQueueMB + stateCacheMB;
    
    this.memoryMetrics.push({
      preloadQueueMB,
      stateCacheMB,
      totalMB,
      timestamp: Date.now()
    });

    // Alert if memory usage is high
    if (totalMB > this.ALERTS.MEMORY_THRESHOLD_MB) {
      console.warn('[MediaMetrics] ALERT: High memory usage', {
        totalMB: Math.round(totalMB * 100) / 100,
        preloadQueueMB: Math.round(preloadQueueMB * 100) / 100,
        stateCacheMB: Math.round(stateCacheMB * 100) / 100
      });
    }

    // Keep only last 100 memory samples
    if (this.memoryMetrics.length > 100) {
      this.memoryMetrics = this.memoryMetrics.slice(-100);
    }
  }

  // Get comprehensive metrics summary
  getSummary(): MetricsSummary {
    const now = Date.now();
    const last5Minutes = now - 5 * 60 * 1000;

    // Filter recent metrics
    const recentPosters = this.posterMetrics.filter(m => 
      m.endTime && m.endTime > last5Minutes
    );
    const recentTTFF = this.ttffMetrics.filter(m => 
      m.firstFrameTime && m.firstFrameTime > last5Minutes
    );
    const recentCache = this.cacheMetrics.filter(m => 
      m.timestamp > last5Minutes
    );
    const recentErrors = this.errorMetrics.filter(m => 
      m.timestamp > last5Minutes
    );
    const recentMemory = this.memoryMetrics.filter(m => 
      m.timestamp > last5Minutes
    );

    // Poster stats
    const successfulPosters = recentPosters.filter(m => m.success && m.loadTime);
    const within200ms = successfulPosters.filter(m => m.loadTime! <= 200).length;
    const avgLoadTime = successfulPosters.length > 0 
      ? successfulPosters.reduce((sum, m) => sum + m.loadTime!, 0) / successfulPosters.length
      : 0;

    // TTFF stats
    const successfulTTFF = recentTTFF.filter(m => m.ttff && !m.error);
    const sortedTTFF = successfulTTFF.map(m => m.ttff!).sort((a, b) => a - b);
    const p50 = sortedTTFF[Math.floor(sortedTTFF.length * 0.5)] || 0;
    const p75 = sortedTTFF[Math.floor(sortedTTFF.length * 0.75)] || 0;
    const p95 = sortedTTFF[Math.floor(sortedTTFF.length * 0.95)] || 0;
    const avgTTFF = successfulTTFF.length > 0
      ? successfulTTFF.reduce((sum, m) => sum + m.ttff!, 0) / successfulTTFF.length
      : 0;

    // Cache stats
    const posterCache = recentCache.filter(m => m.type === 'poster');
    const videoCache = recentCache.filter(m => m.type === 'video');
    const posterHits = posterCache.filter(m => m.hit).length;
    const videoHits = videoCache.filter(m => m.hit).length;
    const totalHits = recentCache.filter(m => m.hit).length;

    // Error stats
    const expiredTokenErrors = recentErrors.filter(m => m.type === 'ExpiredToken').length;
    const totalRequests = recentPosters.length + recentTTFF.length;
    const errorRate = totalRequests > 0 ? recentErrors.length / totalRequests : 0;

    // Memory stats
    const memoryValues = recentMemory.map(m => m.totalMB);
    const avgMemory = memoryValues.length > 0 
      ? memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length
      : 0;
    const peakMemory = memoryValues.length > 0 ? Math.max(...memoryValues) : 0;
    const currentMemory = recentMemory.length > 0 ? recentMemory[recentMemory.length - 1].totalMB : 0;

    return {
      posterStats: {
        total: recentPosters.length,
        within200ms,
        averageLoadTime: Math.round(avgLoadTime),
        successRate: recentPosters.length > 0 ? successfulPosters.length / recentPosters.length : 0
      },
      ttffStats: {
        total: recentTTFF.length,
        p50: Math.round(p50),
        p75: Math.round(p75),
        p95: Math.round(p95),
        averageTTFF: Math.round(avgTTFF)
      },
      cacheStats: {
        posterHitRate: posterCache.length > 0 ? posterHits / posterCache.length : 0,
        videoHitRate: videoCache.length > 0 ? videoHits / videoCache.length : 0,
        totalHits,
        totalRequests: recentCache.length
      },
      errorStats: {
        expiredTokenCount: expiredTokenErrors,
        totalErrors: recentErrors.length,
        errorRate
      },
      memoryStats: {
        averageUsageMB: Math.round(avgMemory * 100) / 100,
        peakUsageMB: Math.round(peakMemory * 100) / 100,
        currentUsageMB: Math.round(currentMemory * 100) / 100
      }
    };
  }

  // Check alerts and log warnings
  checkAlerts(): void {
    const summary = this.getSummary();
    
    // Poster load time alert
    if (summary.posterStats.total > 10) {
      const within200msRate = summary.posterStats.within200ms / summary.posterStats.total;
      if (within200msRate < this.ALERTS.POSTER_200MS_THRESHOLD) {
        console.warn('[MediaMetrics] ALERT: Poster load performance degraded', {
          within200msRate: Math.round(within200msRate * 100),
          threshold: this.ALERTS.POSTER_200MS_THRESHOLD * 100,
          averageLoadTime: summary.posterStats.averageLoadTime
        });
      }
    }

    // TTFF alert
    if (summary.ttffStats.p75 > this.ALERTS.TTFF_P75_THRESHOLD) {
      console.warn('[MediaMetrics] ALERT: TTFF P75 exceeds threshold', {
        p75: summary.ttffStats.p75,
        threshold: this.ALERTS.TTFF_P75_THRESHOLD
      });
    }

    // Error rate alert
    if (summary.errorStats.errorRate > this.ALERTS.ERROR_RATE_THRESHOLD) {
      console.error('[MediaMetrics] ALERT: High error rate detected', {
        errorRate: Math.round(summary.errorStats.errorRate * 100),
        threshold: this.ALERTS.ERROR_RATE_THRESHOLD * 100,
        expiredTokenCount: summary.errorStats.expiredTokenCount
      });
    }
  }

  // Cleanup old metrics to prevent memory leaks
  cleanup(maxAge = 30 * 60 * 1000): void { // 30 minutes
    const cutoff = Date.now() - maxAge;
    
    this.posterMetrics = this.posterMetrics.filter(m => 
      (m.endTime || m.startTime) > cutoff
    );
    this.ttffMetrics = this.ttffMetrics.filter(m => 
      (m.firstFrameTime || m.startTime) > cutoff
    );
    this.cacheMetrics = this.cacheMetrics.filter(m => 
      m.timestamp > cutoff
    );
    this.errorMetrics = this.errorMetrics.filter(m => 
      m.timestamp > cutoff
    );
    // Memory metrics are already limited to 100 entries
  }

  // Export metrics for external analysis
  exportMetrics() {
    return {
      posters: this.posterMetrics,
      ttff: this.ttffMetrics,
      cache: this.cacheMetrics,
      errors: this.errorMetrics,
      memory: this.memoryMetrics,
      summary: this.getSummary()
    };
  }
}

export default MediaMetrics;
