/**
 * One-at-a-Time Discovery Loop
 * 
 * Implements the core discovery process:
 * - Single item per iteration
 * - 2-4s time budget
 * - Jittered delays
 * - Multi-tier deduplication
 * - AI image generation
 */

import { PrismaClient } from '@prisma/client';
import { SearchFrontier } from './frontier';
import { checkDeduplication, markContentProcessed } from './deduplication';
import { generateContentFingerprint } from './simhash';
import { canonicalize } from './canonicalization';
import { DiscoveryRedis } from './redis';
import { BatchedLogger, MetricsTracker } from './logger';

const prisma = new PrismaClient();

export interface DiscoveryConfig {
  groupId: string;
  patchHandle: string;
  maxIterations?: number;
  timeBudgetMs?: number;
  jitterMs?: number;
}

export interface DiscoveryResult {
  success: boolean;
  item?: any;
  error?: string;
  iteration: number;
  timeMs: number;
}

export interface DiscoveryState {
  isRunning: boolean;
  currentIteration: number;
  totalFound: number;
  totalDuplicates: number;
  lastItemAt?: Date;
  errors: string[];
}

/**
 * Discovery Loop Manager
 */
export class DiscoveryLoop {
  private config: DiscoveryConfig;
  private frontier: SearchFrontier;
  private state: DiscoveryState;
  private logger: BatchedLogger;
  private metrics: MetricsTracker;
  
  constructor(config: DiscoveryConfig) {
    this.config = {
      maxIterations: 10,
      timeBudgetMs: 3000, // 3 seconds
      jitterMs: 500, // 500ms jitter
      ...config
    };
    
    this.frontier = new SearchFrontier(config.groupId);
    this.state = {
      isRunning: false,
      currentIteration: 0,
      totalFound: 0,
      totalDuplicates: 0,
      errors: []
    };
    
    this.logger = new BatchedLogger(60000); // Flush every minute
    this.metrics = new MetricsTracker(config.groupId);
  }
  
  /**
   * Start discovery loop
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Discovery loop is already running');
    }
    
    this.state.isRunning = true;
    this.state.currentIteration = 0;
    this.state.totalFound = 0;
    this.state.totalDuplicates = 0;
    this.state.errors = [];
    
    console.log(`[Discovery] Starting discovery loop for group ${this.config.groupId}`);
    
    try {
      // Initialize frontier if needed
      await this.frontier.initializeFrontier(this.config.patchHandle);
      
      // Run discovery iterations
      for (let i = 0; i < this.config.maxIterations!; i++) {
        if (!this.state.isRunning) break;
        
        this.state.currentIteration = i + 1;
        const result = await this.runIteration();
        
        if (result.success && result.item) {
          this.state.totalFound++;
          this.state.lastItemAt = new Date();
        }
        
        // Add jittered delay
        const delay = this.config.jitterMs! + Math.random() * 300; // 500-800ms
        await this.sleep(delay);
      }
      
    } catch (error) {
      console.error('[Discovery] Loop error:', error);
      this.state.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      this.state.isRunning = false;
      
      // Print final summary
      this.logger.flush();
      this.metrics.printSummary();
      
      // Save metrics to Redis
      await this.metrics.saveMetrics();
      
      console.log(`[Discovery] Loop completed. Found: ${this.state.totalFound}, Duplicates: ${this.state.totalDuplicates}`);
    }
  }
  
  /**
   * Stop discovery loop
   */
  async stop(): Promise<void> {
    this.state.isRunning = false;
    console.log('[Discovery] Stopping discovery loop');
  }
  
  /**
   * Run single discovery iteration
   */
  private async runIteration(): Promise<DiscoveryResult> {
    const startTime = Date.now();
    
    try {
      // Get next candidate from frontier
      const candidate = await this.frontier.getNextCandidate();
      if (!candidate) {
        return {
          success: false,
          error: 'No candidates available',
          iteration: this.state.currentIteration,
          timeMs: Date.now() - startTime
        };
      }
      
      // Fetch content from source
      const content = await this.fetchContent(candidate);
      if (!content) {
        await this.frontier.updateCandidateAfterProcessing(candidate, false);
        return {
          success: false,
          error: 'Failed to fetch content',
          iteration: this.state.currentIteration,
          timeMs: Date.now() - startTime
        };
      }
      
      // Check relevance score early (before deduplication)
      const relevanceScore = content.relevanceScore || 0;
      if (relevanceScore < 0.7) {
        console.log(`[Discovery] Skipping low relevance item: ${content.title} (score: ${relevanceScore})`);
        this.logger.logSkip(content.url, `Low relevance score: ${relevanceScore}`);
        await this.frontier.updateCandidateAfterProcessing(candidate, false);
        
        // Log to rejected content
        await prisma.rejectedContent.create({
          data: {
            patchId: this.config.groupId,
            url: content.url,
            reason: `low_relevance:${relevanceScore}`,
            contentHash: null,
            rejectedAt: new Date()
          }
        }).catch(() => {}); // Don't fail if logging fails
        
        return {
          success: false,
          error: `Low relevance: ${relevanceScore}`,
          iteration: this.state.currentIteration,
          timeMs: Date.now() - startTime
        };
      }
      
      // Check deduplication
      const dedupResult = await checkDeduplication({
        groupId: this.config.groupId,
        url: content.url,
        title: content.title,
        content: content.content,
        description: content.description,
        domain: content.domain
      });
      
      if (dedupResult.isDuplicate) {
        this.state.totalDuplicates++;
        await this.frontier.updateCandidateAfterProcessing(candidate, false);
        
        // Log duplicate (batched)
        this.logger.logDuplicate(content.url, dedupResult.tier!, candidate.source);
        this.metrics.recordDuplicate();
        
        return {
          success: false,
          error: `Duplicate detected (${dedupResult.tier})`,
          iteration: this.state.currentIteration,
          timeMs: Date.now() - startTime
        };
      }
      
      // Generate content hash
      const contentHash = generateContentFingerprint({
        title: content.title,
        content: content.content,
        description: content.description
      });
      
      // Canonicalize URL
      const canonicalResult = await canonicalize(content.url);
      
      // Save to database
      const savedItem = await this.saveDiscoveredContent({
        ...content,
        canonicalUrl: canonicalResult.canonicalUrl,
        contentHash,
        domain: content.domain || canonicalResult.finalDomain
      });
      
      // Mark as processed
      await markContentProcessed(
        this.config.groupId,
        canonicalResult.canonicalUrl,
        contentHash,
        content.domain
      );
      
      // Update frontier
      await this.frontier.updateCandidateAfterProcessing(candidate, true);
      
      // Log success and record metrics
      const processingTime = Date.now() - startTime;
      this.logger.logSuccess(savedItem.url!, processingTime);
      this.metrics.recordNovel(processingTime);
      
      // Update frontier depth metric
      const stats = await this.frontier.getFrontierStats();
      this.metrics.updateFrontierDepth(stats.totalCandidates);
      
      // Generate AI image (background)
      this.generateAIImage(savedItem.id).catch(error => {
        this.logger.logError('AI image generation failed', { itemId: savedItem.id, error: error.message });
      });
      
      return {
        success: true,
        item: savedItem,
        iteration: this.state.currentIteration,
        timeMs: processingTime
      };
      
    } catch (error) {
      console.error('[Discovery] Iteration error:', error);
      this.state.errors.push(error instanceof Error ? error.message : String(error));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        iteration: this.state.currentIteration,
        timeMs: Date.now() - startTime
      };
    }
  }
  
  /**
   * Fetch content from source
   */
  private async fetchContent(candidate: any): Promise<any | null> {
    try {
      // Call DeepSeek API to find relevant content
      console.log(`[Discovery] Fetching content from DeepSeek for: ${this.config.patchHandle}`);
      
      const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a research assistant that finds ONE high-quality, relevant piece of content.
              Return ONLY ONE result as a JSON object with this structure:
              {
                "title": "Content title",
                "url": "https://example.com/article",
                "type": "article|video|paper|report|news",
                "description": "Brief description of the content",
                "relevance_score": 0.95,
                "source_authority": "high|medium|low"
              }
              
              Only return content that is highly relevant (relevance_score > 0.7) and from authoritative sources.`
            },
            {
              role: 'user',
              content: `Find ONE high-quality, relevant piece of content about: "${this.config.patchHandle}". 
              Focus on recent, authoritative sources. Return as JSON.`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      
      if (!deepSeekResponse.ok) {
        console.error('[Discovery] DeepSeek API error:', deepSeekResponse.status);
        this.metrics.recordError();
        return null;
      }
      
      const deepSeekData = await deepSeekResponse.json();
      const content = deepSeekData.choices?.[0]?.message?.content;
      
      if (!content) {
        return null;
      }
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const item = JSON.parse(jsonString);
      
      // Extract domain from URL
      let domain = 'unknown';
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {}
      
      return {
        url: item.url,
        title: item.title,
        content: item.description || '',
        description: item.description || '',
        domain: domain,
        type: item.type || 'article',
        relevanceScore: item.relevance_score || 0.8
      };
      
    } catch (error) {
      console.error('[Discovery] Content fetch error:', error);
      this.logger.logError('Content fetch failed', { 
        source: candidate?.source, 
        error: error instanceof Error ? error.message : String(error)
      });
      this.metrics.recordError();
      return null;
    }
  }
  
  /**
   * Save discovered content to database
   */
  private async saveDiscoveredContent(content: any): Promise<any> {
    // Use DeepSeek relevance score (0.0-1.0) converted to 1-10 scale
    const relevanceScore = content.relevanceScore 
      ? Math.round(content.relevanceScore * 10) 
      : 8;
    
    const savedItem = await prisma.discoveredContent.create({
      data: {
        patchId: this.config.groupId,
        title: content.title,
        description: content.description,
        url: content.url,
        canonicalUrl: content.canonicalUrl,
        content: content.content,
        type: content.type || 'article',
        status: 'ready',
        relevanceScore: relevanceScore,
        contentHash: content.contentHash,
        domain: content.domain,
        mediaAssets: {
          hero: null,
          source: 'generated',
          license: 'generated'
        },
        metadata: {
          sourceDomain: content.domain,
          publishDate: new Date().toISOString()
        },
        enrichedContent: {
          summary: content.description,
          keyPoints: [],
          readingTimeMin: Math.ceil((content.content || '').length / 1000)
        }
      }
    });
    
    return savedItem;
  }
  
  /**
   * Generate AI image for content
   */
  private async generateAIImage(itemId: string): Promise<void> {
    try {
      console.log(`[Discovery] Generating AI image for item ${itemId}`);
      
      // Get the item details
      const item = await prisma.discoveredContent.findUnique({
        where: { id: itemId },
        select: { title: true, description: true, type: true }
      });
      
      if (!item) {
        console.error(`[Discovery] Item ${itemId} not found`);
        return;
      }
      
      // Call the AI image generation API
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3005';
      const aiImageResponse = await fetch(`${baseUrl}/api/ai/generate-hero-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          summary: item.description || '',
          contentType: item.type,
          artisticStyle: 'photorealistic',
          enableHiresFix: false
        })
      });
      
      if (!aiImageResponse.ok) {
        console.error(`[Discovery] AI image API error: ${aiImageResponse.status}`);
        return;
      }
      
      const aiImageData = await aiImageResponse.json();
      
      if (aiImageData.success && aiImageData.imageUrl) {
        // Update media assets with the generated image
        await prisma.discoveredContent.update({
          where: { id: itemId },
          data: {
            mediaAssets: {
              hero: aiImageData.imageUrl,
              source: 'ai-generated',
              license: 'generated'
            }
          }
        });
        
        console.log(`[Discovery] ✅ AI image generated for item ${itemId}`);
      } else {
        console.warn(`[Discovery] No image generated for item ${itemId}`);
      }
      
    } catch (error) {
      console.error('[Discovery] AI image generation failed:', error);
      this.logger.logError('AI image generation failed', { 
        itemId, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Get current state
   */
  getState(): DiscoveryState {
    return { ...this.state };
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
