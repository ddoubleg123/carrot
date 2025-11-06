/**
 * Batched Logging and Metrics System
 * 
 * Reduces log spam by batching similar messages
 * Tracks performance metrics for monitoring
 */

export interface LogBatch {
  type: 'duplicate' | 'error' | 'success' | 'skip';
  message: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  details: any[];
}

export interface DiscoveryMetrics {
  timeToFirstNovel?: number;
  duplicatesPerMin: number;
  novelRate: number;
  itemsPerHour: number;
  frontierDepth: number;
  providerErrorRate: number;
  totalProcessed: number;
  totalNovel: number;
  totalDuplicates: number;
  averageProcessingTime: number;
}

/**
 * Batched Logger
 */
export class BatchedLogger {
  private batches: Map<string, LogBatch> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private flushIntervalMs: number = 60000; // 1 minute
  
  constructor(flushIntervalMs: number = 60000) {
    this.flushIntervalMs = flushIntervalMs;
    this.startFlushTimer();
  }
  
  /**
   * Log a message (batched)
   */
  log(type: LogBatch['type'], message: string, details?: any): void {
    const key = `${type}:${message}`;
    const existing = this.batches.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      if (details) existing.details.push(details);
    } else {
      this.batches.set(key, {
        type,
        message,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        details: details ? [details] : []
      });
    }
  }
  
  /**
   * Log duplicate skip
   */
  logDuplicate(url: string, tier: 'A' | 'B' | 'C', source?: string): void {
    this.log('duplicate', `Skipping duplicate (Tier ${tier})`, { url, source });
  }
  
  /**
   * Log error
   */
  logError(error: string, context?: any): void {
    this.log('error', error, context);
  }
  
  /**
   * Log success
   */
  logSuccess(url: string, processingTime: number): void {
    this.log('success', 'Item processed successfully', { url, processingTime });
  }
  
  /**
   * Log skip
   */
  logSkip(url: string, reason: string): void {
    this.log('skip', `Skipping item: ${reason}`, { url });
  }
  
  /**
   * Flush batches to console
   */
  flush(): void {
    if (this.batches.size === 0) return;
    
    console.log('\n========== Discovery Log Summary ==========');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Total batches: ${this.batches.size}\n`);
    
    // Group by type
    const byType = new Map<string, LogBatch[]>();
    for (const batch of this.batches.values()) {
      const existing = byType.get(batch.type) || [];
      existing.push(batch);
      byType.set(batch.type, existing);
    }
    
    // Print summary by type
    for (const [type, batches] of byType.entries()) {
      const totalCount = batches.reduce((sum, b) => sum + b.count, 0);
      console.log(`\n[${type.toUpperCase()}] Total: ${totalCount}`);
      
      // Sort by count (highest first)
      batches.sort((a, b) => b.count - a.count);
      
      // Print top 5
      for (const batch of batches.slice(0, 5)) {
        const duration = batch.lastSeen.getTime() - batch.firstSeen.getTime();
        console.log(`  • ${batch.message}: ${batch.count} occurrences (${Math.round(duration / 1000)}s)`);
        
        // Show sample details
        if (batch.details.length > 0 && batch.count <= 3) {
          batch.details.forEach(detail => {
            console.log(`    - ${detail.url || JSON.stringify(detail)}`);
          });
        } else if (batch.details.length > 0) {
          console.log(`    Last: ${batch.details[batch.details.length - 1].url || 'N/A'}`);
        }
      }
      
      if (batches.length > 5) {
        console.log(`  ... and ${batches.length - 5} more`);
      }
    }
    
    console.log('\n==========================================\n');
    
    // Clear batches
    this.batches.clear();
  }
  
  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }
  
  /**
   * Stop flush timer
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }
  
  /**
   * Get current batches (for testing)
   */
  getBatches(): LogBatch[] {
    return Array.from(this.batches.values());
  }
}

/**
 * Metrics Tracker
 */
export class MetricsTracker {
  private groupId: string;
  private startTime: number = 0;
  private metrics: DiscoveryMetrics = {
    duplicatesPerMin: 0,
    novelRate: 0,
    itemsPerHour: 0,
    frontierDepth: 0,
    providerErrorRate: 0,
    totalProcessed: 0,
    totalNovel: 0,
    totalDuplicates: 0,
    averageProcessingTime: 0
  };
  private processingTimes: number[] = [];
  
  constructor(groupId: string) {
    this.groupId = groupId;
    this.startTime = Date.now();
  }
  
  /**
   * Record novel item found
   */
  recordNovel(processingTime: number): void {
    this.metrics.totalNovel++;
    this.metrics.totalProcessed++;
    this.processingTimes.push(processingTime);
    
    // Record time to first novel
    if (this.metrics.totalNovel === 1) {
      this.metrics.timeToFirstNovel = Date.now() - this.startTime;
    }
    
    this.updateDerivedMetrics();
  }
  
  /**
   * Record duplicate found
   */
  recordDuplicate(): void {
    this.metrics.totalDuplicates++;
    this.metrics.totalProcessed++;
    this.updateDerivedMetrics();
  }
  
  /**
   * Record provider error
   */
  recordError(): void {
    this.metrics.totalProcessed++;
    this.updateDerivedMetrics();
  }
  
  /**
   * Update frontier depth
   */
  updateFrontierDepth(depth: number): void {
    this.metrics.frontierDepth = depth;
  }
  
  /**
   * Update derived metrics
   */
  private updateDerivedMetrics(): void {
    const elapsedMin = (Date.now() - this.startTime) / 60000;
    const elapsedHour = elapsedMin / 60;
    
    if (elapsedMin > 0) {
      this.metrics.duplicatesPerMin = this.metrics.totalDuplicates / elapsedMin;
      this.metrics.itemsPerHour = this.metrics.totalNovel / elapsedHour;
    }
    
    if (this.metrics.totalProcessed > 0) {
      this.metrics.novelRate = this.metrics.totalNovel / this.metrics.totalProcessed;
      this.metrics.providerErrorRate = (this.metrics.totalProcessed - this.metrics.totalNovel - this.metrics.totalDuplicates) / this.metrics.totalProcessed;
    }
    
    if (this.processingTimes.length > 0) {
      this.metrics.averageProcessingTime = this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
    }
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): DiscoveryMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Save metrics to Redis (disabled - no Redis dependency)
   */
  async saveMetrics(): Promise<void> {
    // Redis removed - metrics only printed to console
    // Future: could save to database if needed
    console.log('[Metrics] Metrics saved to console');
  }
  
  /**
   * Print metrics summary
   */
  printSummary(): void {
    console.log('\n========== Discovery Metrics Summary ==========');
    console.log(`Group: ${this.groupId}`);
    console.log(`Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
    console.log(`\nPerformance:`);
    console.log(`  • Time to first novel: ${this.metrics.timeToFirstNovel || 'N/A'}ms`);
    console.log(`  • Average processing time: ${Math.round(this.metrics.averageProcessingTime)}ms`);
    console.log(`\nResults:`);
    console.log(`  • Total processed: ${this.metrics.totalProcessed}`);
    console.log(`  • Novel items: ${this.metrics.totalNovel}`);
    console.log(`  • Duplicates: ${this.metrics.totalDuplicates}`);
    console.log(`  • Novel rate: ${(this.metrics.novelRate * 100).toFixed(1)}%`);
    console.log(`\nRates:`);
    console.log(`  • Duplicates per minute: ${this.metrics.duplicatesPerMin.toFixed(2)}`);
    console.log(`  • Items per hour: ${this.metrics.itemsPerHour.toFixed(2)}`);
    console.log(`  • Provider error rate: ${(this.metrics.providerErrorRate * 100).toFixed(1)}%`);
    console.log(`\nFrontier:`);
    console.log(`  • Current depth: ${this.metrics.frontierDepth}`);
    console.log('\n===============================================\n');
  }
}

/**
 * Global logger instance
 */
export const logger = new BatchedLogger();


// Discovery Audit Event Bus for SSE
const auditSubscribers = new Map<string, Set<(event: any) => void>>()

/**
 * Subscribe to audit events for a patch
 */
export function subscribeAudit(patchId: string, callback: (event: any) => void): () => void {
  if (!auditSubscribers.has(patchId)) {
    auditSubscribers.set(patchId, new Set())
  }
  auditSubscribers.get(patchId)!.add(callback)
  
  return () => {
    const subs = auditSubscribers.get(patchId)
    if (subs) {
      subs.delete(callback)
      if (subs.size === 0) {
        auditSubscribers.delete(patchId)
      }
    }
  }
}

/**
 * Publish audit event to all subscribers
 */
function publishAudit(patchId: string, event: any): void {
  const subs = auditSubscribers.get(patchId)
  if (subs) {
    subs.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('[Audit] Error in subscriber:', error)
      }
    })
  }
}

export interface AuditPayload {
  runId: string
  patchId: string
  step: string
  status: 'pending' | 'ok' | 'fail'
  provider?: string
  query?: string
  candidateUrl?: string
  finalUrl?: string
  http?: any
  meta?: any
  rulesHit?: any
  scores?: any
  decisions?: any
  hashes?: any
  synthesis?: any
  hero?: any
  timings?: any
  error?: any
}

/**
 * Audit Emitter - persists to DB and publishes SSE
 */
export const audit = {
  async emit(payload: AuditPayload): Promise<void> {
    const { prisma } = await import('@/lib/prisma')
    
    try {
      // Persist to database
      const auditRecord = await prisma.discoveryAudit.create({
        data: {
          runId: payload.runId,
          patchId: payload.patchId,
          step: payload.step,
          status: payload.status,
          provider: payload.provider,
          query: payload.query,
          candidateUrl: payload.candidateUrl,
          finalUrl: payload.finalUrl,
          http: payload.http,
          meta: payload.meta,
          rulesHit: payload.rulesHit,
          scores: payload.scores,
          decisions: payload.decisions,
          hashes: payload.hashes,
          synthesis: payload.synthesis,
          hero: payload.hero,
          timings: payload.timings,
          error: payload.error
        }
      })
      
      // Publish SSE event
      publishAudit(payload.patchId, auditRecord)
      
    } catch (error) {
      console.error('[Audit] Failed to persist audit:', error)
      // Still publish even if DB fails
      publishAudit(payload.patchId, { ...payload, ts: new Date() })
    }
  }
}
