/**
 * Main crawler orchestrator
 * Coordinates discovery queue processing and extraction queue processing
 * Phase 6: Observability integration
 */

import { CrawlerService } from './service'
import { seedDiscoveryQueue } from './seeding'
import { processExtractionQueue } from './extractor'
import { 
  getDiscoveryQueueDepth, 
  getExtractionQueueDepth 
} from './queues'
import { crawlerConfig } from './config'
import { CRAWLER_PRIORITY_V2, EXTRACTOR_V2 } from '../discovery/flags'
import { slog } from '../log'
import { inc, histogram, gauge } from '../metrics'
import { prisma } from '../prisma'

interface CrawlerRunOptions {
  topic: string
  durationMinutes?: number
  maxPages?: number
  highSignalDomains?: string[]
}

interface CrawlerRunResult {
  success: boolean
  stats: {
    fetched: number
    enqueued: number
    deduped: number
    skipped: number
    persisted: number
    extracted: number
    errors: number
  }
  durationSeconds: number
}

/**
 * Main crawler orchestrator
 */
export class CrawlerOrchestrator {
  private crawler: CrawlerService
  private stopRequested = false
  private extractionCount = 0
  private startTime?: number
  
  constructor() {
    this.crawler = new CrawlerService()
  }
  
  /**
   * Run crawler for a topic
   */
  async run(options: CrawlerRunOptions): Promise<CrawlerRunResult> {
    const { topic, durationMinutes = 5, maxPages = 100, highSignalDomains } = options
    this.startTime = Date.now()
    this.stopRequested = false
    this.extractionCount = 0
    
    slog('info', {
      service: 'crawler',
      step: 'orchestrator',
      action: 'start',
      status: 'ok',
      topic,
      duration_minutes: durationMinutes,
      max_pages: maxPages,
    })
    
    inc('crawl_started', 1, { topic })
    
    try {
      // Seed discovery queue
      const seedsEnqueued = await seedDiscoveryQueue({
        topic,
        highSignalDomains,
        maxSeeds: 10,
      })
      
      slog('info', {
        service: 'crawler',
        step: 'seed',
        action: 'enqueue',
        status: 'ok',
        topic,
        seeds_enqueued: seedsEnqueued,
      })
      
      // Start extraction worker in background
      const extractionWorker = EXTRACTOR_V2
        ? this.startExtractionWorker()
        : Promise.resolve()
      
      // Main discovery loop
      const discoveryPromise = this.runDiscoveryLoop(topic, durationMinutes, maxPages)
      
      // Wait for discovery to complete or timeout
      await discoveryPromise
      
      // Stop extraction worker
      this.stopRequested = true
      await extractionWorker.catch(() => {}) // Ignore errors on stop
      
      const duration = Math.floor((Date.now() - (this.startTime || 0)) / 1000)
      const stats = this.crawler.getStats()
      
      // Zero results debug alert
      if (this.extractionCount === 0 && stats.fetched > 0) {
        const recentPages = await prisma.crawlerPage.findMany({
          where: {
            firstSeenAt: {
              gte: new Date(Date.now() - crawlerConfig.zeroAlertWindowMin * 60 * 1000),
            },
          },
          select: {
            url: true,
            reasonCode: true,
            status: true,
          },
          take: 10,
          orderBy: { firstSeenAt: 'desc' },
        })
        
        const reasonCounts: Record<string, number> = {}
        recentPages.forEach(p => {
          if (p.reasonCode) {
            reasonCounts[p.reasonCode] = (reasonCounts[p.reasonCode] || 0) + 1
          }
        })
        
        const topReasons = Object.entries(reasonCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count }))
        
        slog('warn', {
          service: 'crawler',
          step: 'zero_results_alert',
          action: 'alert',
          status: 'warning',
          topic,
          fetched: stats.fetched,
          extracted: this.extractionCount,
          top_reasons: topReasons,
          last_10_urls: recentPages.map(p => ({
            url: p.url?.slice(0, 100),
            reason: p.reasonCode,
            status: p.status,
          })),
        })
      }
      
      const result: CrawlerRunResult = {
        success: true,
        stats: {
          ...stats,
          extracted: this.extractionCount,
        },
        durationSeconds: duration,
      }
      
      slog('info', {
        service: 'crawler',
        step: 'orchestrator',
        action: 'complete',
        status: 'ok',
        topic,
        ...result.stats,
        duration_seconds: duration,
      })
      
      return result
    } catch (error: any) {
      const duration = Math.floor((Date.now() - (this.startTime || 0)) / 1000)
      
      slog('error', {
        service: 'crawler',
        step: 'orchestrator',
        action: 'error',
        status: 'error',
        topic,
        error: error.message?.slice(0, 200),
        duration_seconds: duration,
      })
      
      throw error
    }
  }
  
  /**
   * Main discovery loop
   */
  private async runDiscoveryLoop(
    topic: string,
    durationMinutes: number,
    maxPages: number
  ): Promise<void> {
    const endTime = Date.now() + (durationMinutes * 60 * 1000)
    let pagesProcessed = 0
    
    while (!this.stopRequested && Date.now() < endTime && pagesProcessed < maxPages) {
      try {
        await this.crawler.processUrl(topic)
        pagesProcessed++
        
        const stats = this.crawler.getStats()
        
        // Emit metrics
        gauge('discovery_queue_depth', await getDiscoveryQueueDepth())
        gauge('extraction_queue_depth', await getExtractionQueueDepth())
        
        // Log heartbeat every 10 pages
        if (pagesProcessed % 10 === 0) {
          slog('info', {
            service: 'crawler',
            step: 'heartbeat',
            action: 'progress',
            status: 'ok',
            topic,
            pages_processed: pagesProcessed,
            ...stats,
            queue_depth: await getDiscoveryQueueDepth(),
            extraction_queue_depth: await getExtractionQueueDepth(),
          })
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error: any) {
        slog('error', {
          service: 'crawler',
          step: 'discovery_loop',
          action: 'error',
          status: 'error',
          error: error.message?.slice(0, 200),
        })
        inc('crawl_fail', 1)
      }
    }
  }
  
  /**
   * Background extraction worker
   */
  private async startExtractionWorker(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await processExtractionQueue()
        this.extractionCount++
        inc('extraction_ok', 1)
      } catch (error: any) {
        inc('extraction_fail', 1)
        slog('error', {
          service: 'crawler',
          step: 'extraction_worker',
          action: 'error',
          status: 'error',
          error: error.message?.slice(0, 200),
        })
      }
      
      // Small delay if queue is empty
      const queueDepth = await getExtractionQueueDepth()
      if (queueDepth === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  /**
   * Request stop
   */
  requestStop(): void {
    this.stopRequested = true
  }
}

