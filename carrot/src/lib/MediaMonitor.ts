import MediaMetrics from './MediaMetrics';
import MediaPreloadQueue from './MediaPreloadQueue';
import MediaStateCache from './MediaStateCache';

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  timestamp: number;
}

// Singleton MediaMonitor for automatic health monitoring
class MediaMonitor {
  private static _instance: MediaMonitor | null = null;
  
  static get instance(): MediaMonitor {
    if (!this._instance) {
      this._instance = new MediaMonitor();
    }
    return this._instance;
  }

  private isRunning = false;
  private healthCheckInterval?: number;
  private metricsCleanupInterval?: number;
  private memoryTrackingInterval?: number;
  
  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  private readonly METRICS_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MEMORY_TRACKING_INTERVAL = 10 * 1000; // 10 seconds

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[MediaMonitor] Starting monitoring...');

    // Periodic health checks
    this.healthCheckInterval = window.setInterval(() => {
      this.runHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Periodic metrics cleanup
    this.metricsCleanupInterval = window.setInterval(() => {
      MediaMetrics.instance.cleanup();
      MediaStateCache.instance.cleanup();
      MediaPreloadQueue.instance.cleanup();
    }, this.METRICS_CLEANUP_INTERVAL);

    // Memory usage tracking
    this.memoryTrackingInterval = window.setInterval(() => {
      this.trackMemoryUsage();
    }, this.MEMORY_TRACKING_INTERVAL);

    // Initial health check
    this.runHealthCheck();
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('[MediaMonitor] Stopping monitoring...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = undefined;
    }

    if (this.memoryTrackingInterval) {
      clearInterval(this.memoryTrackingInterval);
      this.memoryTrackingInterval = undefined;
    }
  }

  private runHealthCheck(): void {
    const status = this.getHealthStatus();
    
    if (status.overall === 'critical') {
      console.error('[MediaMonitor] CRITICAL health status detected!', status);
      this.sendAlert('critical', status.issues);
    } else if (status.overall === 'warning') {
      console.warn('[MediaMonitor] Warning health status detected', status);
    }

    // Run metrics alert checks
    MediaMetrics.instance.checkAlerts();
  }

  private trackMemoryUsage(): void {
    const queueStats = MediaPreloadQueue.instance.getStats();
    const cacheStats = MediaStateCache.instance.getStats();
    
    const preloadQueueMB = queueStats.globalBudgetUsed / 1024 / 1024;
    const stateCacheMB = cacheStats.totalSizeMB;
    
    MediaMetrics.instance.recordMemoryUsage(preloadQueueMB, stateCacheMB);
  }

  getHealthStatus(): HealthStatus {
    const metrics = MediaMetrics.instance.getSummary();
    const queueStats = MediaPreloadQueue.instance.getStats();
    const cacheStats = MediaStateCache.instance.getStats();
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    let severity: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check ExpiredToken errors
    if (metrics.errorStats.expiredTokenCount > 0) {
      issues.push(`${metrics.errorStats.expiredTokenCount} ExpiredToken errors detected`);
      recommendations.push('Check GCS credentials and public thumbnail configuration');
      severity = 'critical';
    }

    // Check error rate
    if (metrics.errorStats.errorRate > 0.1) {
      issues.push(`High error rate: ${Math.round(metrics.errorStats.errorRate * 100)}%`);
      recommendations.push('Investigate network connectivity and API endpoints');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check poster performance
    if (metrics.posterStats.total > 10) {
      const within200msRate = metrics.posterStats.within200ms / metrics.posterStats.total;
      if (within200msRate < 0.6) {
        issues.push(`Only ${Math.round(within200msRate * 100)}% of posters load within 200ms`);
        recommendations.push('Consider optimizing poster sizes or CDN configuration');
        if (severity !== 'critical') severity = 'warning';
      }
    }

    // Check TTFF performance
    if (metrics.ttffStats.p75 > 1000) {
      issues.push(`P75 TTFF is ${metrics.ttffStats.p75}ms (target: <800ms)`);
      recommendations.push('Increase video preload buffer or optimize video encoding');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check memory usage
    const totalMemoryMB = queueStats.globalBudgetUsed / 1024 / 1024 + cacheStats.totalSizeMB;
    if (totalMemoryMB > 300) {
      issues.push(`High memory usage: ${Math.round(totalMemoryMB)}MB`);
      recommendations.push('Consider reducing cache sizes or cleanup frequency');
      severity = 'critical';
    } else if (totalMemoryMB > 200) {
      issues.push(`Elevated memory usage: ${Math.round(totalMemoryMB)}MB`);
      recommendations.push('Monitor memory usage trends');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check cache performance
    if (cacheStats.hitRate < 0.5 && cacheStats.totalEntries > 10) {
      issues.push(`Low cache hit rate: ${Math.round(cacheStats.hitRate * 100)}%`);
      recommendations.push('Review cache eviction policies and size limits');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check queue health
    if (!queueStats.isProcessing && Object.values(queueStats.byType).some(stats => stats.queued > 0)) {
      issues.push('Preload queue has tasks but is not processing');
      recommendations.push('Check for queue processing errors or deadlocks');
      severity = 'critical';
    }

    return {
      overall: severity,
      issues,
      recommendations,
      timestamp: Date.now()
    };
  }

  private sendAlert(level: 'warning' | 'critical', issues: string[]): void {
    // In production, integrate with your alerting system
    // For now, just log and optionally send to analytics
    
    const alertData = {
      level,
      issues,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error(`[MediaMonitor] ${level.toUpperCase()} ALERT:`, alertData);

    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'media_alert', {
        event_category: 'performance',
        event_label: level,
        value: issues.length,
        custom_parameters: {
          issues: issues.join('; ')
        }
      });
    }

    // In production, you might also:
    // - Send to Sentry/Bugsnag
    // - Post to Slack webhook
    // - Send to custom monitoring endpoint
    // - Show user notification for critical issues
  }

  // Manual health check for debugging
  checkHealth(): HealthStatus {
    return this.getHealthStatus();
  }

  // Get monitoring stats
  getMonitoringStats() {
    return {
      isRunning: this.isRunning,
      healthCheckInterval: this.HEALTH_CHECK_INTERVAL,
      metricsCleanupInterval: this.METRICS_CLEANUP_INTERVAL,
      memoryTrackingInterval: this.MEMORY_TRACKING_INTERVAL,
      lastHealthCheck: this.getHealthStatus()
    };
  }
}

// Auto-start monitoring in browser environment
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay to allow other systems to initialize
  setTimeout(() => {
    MediaMonitor.instance.start();
  }, 2000);

  // Stop monitoring on page unload
  window.addEventListener('beforeunload', () => {
    MediaMonitor.instance.stop();
  });
}

export default MediaMonitor;
