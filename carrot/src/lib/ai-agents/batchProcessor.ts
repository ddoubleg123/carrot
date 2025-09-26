import { PrismaClient } from '@prisma/client';
import FeedService, { FeedItem } from './feedService';
import AgentRegistry from './agentRegistry';

const prisma = new PrismaClient();

export interface BatchFeedJob {
  id: string;
  agentId: string;
  feedItems: FeedItem[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchFeedResult {
  jobId: string;
  status: 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  memoryIds: string[];
}

export class BatchProcessor {
  /**
   * Create a new batch feed job
   */
  static async createBatchJob(agentId: string, feedItems: FeedItem[]): Promise<BatchFeedJob> {
    const job: BatchFeedJob = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      feedItems,
      status: 'pending',
      progress: 0,
      totalItems: feedItems.length,
      processedItems: 0,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In a real implementation, you'd store this in a database
    // For now, we'll process it immediately
    return job;
  }

  /**
   * Process a batch feed job
   */
  static async processBatchJob(job: BatchFeedJob): Promise<BatchFeedResult> {
    const result: BatchFeedResult = {
      jobId: job.id,
      status: 'completed',
      totalItems: job.totalItems,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      memoryIds: [],
    };

    try {
      // Verify agent exists
      const agent = await AgentRegistry.getAgentById(job.agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${job.agentId} not found`);
      }

      // Process each feed item with memory management
      for (let i = 0; i < job.feedItems.length; i++) {
        const feedItem = job.feedItems[i];
        
        try {
          const feedResult = await FeedService.feedAgent(job.agentId, feedItem);
          result.memoryIds.push(...feedResult.memoryIds);
          result.successCount++;
        } catch (error) {
          const errorMessage = `Failed to process item ${i + 1}: ${error}`;
          result.errors.push(errorMessage);
          result.errorCount++;
        }

        result.processedItems++;
        
        // Update progress
        const progress = Math.round((result.processedItems / result.totalItems) * 100);
        job.progress = progress;
        job.processedItems = result.processedItems;
        job.updatedAt = new Date();

        // Force garbage collection every few items
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }

        // Add a delay to prevent overwhelming the system
        if (i < job.feedItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      // Determine final status
      if (result.errorCount > 0 && result.successCount === 0) {
        result.status = 'failed';
      } else if (result.errorCount > 0) {
        result.status = 'completed'; // Partial success
      }

      job.status = result.status === 'failed' ? 'failed' : 'completed';
      job.errors = result.errors;
      job.updatedAt = new Date();

    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Batch processing failed: ${error}`);
      job.status = 'failed';
      job.errors = result.errors;
      job.updatedAt = new Date();
    }

    return result;
  }

  /**
   * Process multiple agents with the same content (memory-efficient)
   */
  static async processMultiAgentFeed(
    agentIds: string[],
    feedItem: FeedItem
  ): Promise<Record<string, BatchFeedResult>> {
    const results: Record<string, BatchFeedResult> = {};

    // Process agents in small batches to avoid memory issues
    const BATCH_SIZE = 3; // Process max 3 agents at a time
    const batches = [];
    
    for (let i = 0; i < agentIds.length; i += BATCH_SIZE) {
      batches.push(agentIds.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      // Process batch sequentially to avoid memory spikes
      for (const agentId of batch) {
        try {
          const job = await this.createBatchJob(agentId, [feedItem]);
          const result = await this.processBatchJob(job);
          results[agentId] = result;
          
          // Force garbage collection between agents
          if (global.gc) {
            global.gc();
          }
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results[agentId] = {
            jobId: `error-${Date.now()}`,
            status: 'failed',
            totalItems: 1,
            processedItems: 0,
            successCount: 0,
            errorCount: 1,
            errors: [`Failed to process agent ${agentId}: ${error}`],
            memoryIds: [],
          };
        }
      }
      
      // Longer delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Process content for agents based on their expertise
   */
  static async processByExpertise(
    content: string,
    sourceType: 'post' | 'url' | 'file' | 'manual',
    expertiseTags?: string[]
  ): Promise<Record<string, BatchFeedResult>> {
    try {
      // Find agents with matching expertise
      let agents;
      if (expertiseTags && expertiseTags.length > 0) {
        agents = await AgentRegistry.getAgentsByExpertise(expertiseTags);
      } else {
        // If no specific expertise, find agents that might be relevant
        agents = await AgentRegistry.getAllAgents();
      }

      if (agents.length === 0) {
        return {};
      }

      // Create feed item
      const feedItem: FeedItem = {
        content,
        sourceType,
        tags: expertiseTags,
      };

      // Process for all matching agents
      const agentIds = agents.map(agent => agent.id);
      return await this.processMultiAgentFeed(agentIds, feedItem);

    } catch (error) {
      console.error('Error processing by expertise:', error);
      return {};
    }
  }

  /**
   * Get batch job status (placeholder for future implementation)
   */
  static async getBatchJobStatus(jobId: string): Promise<BatchFeedJob | null> {
    // TODO: Implement job status tracking with database storage
    return null;
  }

  /**
   * Cancel a batch job (placeholder for future implementation)
   */
  static async cancelBatchJob(jobId: string): Promise<boolean> {
    // TODO: Implement job cancellation
    return false;
  }
}

export default BatchProcessor;
