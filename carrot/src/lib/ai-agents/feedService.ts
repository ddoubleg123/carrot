import { PrismaClient } from '@prisma/client';
import EmbeddingService, { MemoryData } from './embeddingService';
import ContentExtractor, { ExtractedContent } from './contentExtractor';

const prisma = new PrismaClient();

export interface FeedItem {
  content: string;
  sourceType: 'url' | 'file' | 'post' | 'manual';
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  tags?: string[];
  threadId?: string;
  topicId?: string;
}

export interface FeedPreview {
  content: string;
  sourceType: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  chunks: string[];
  estimatedMemories: number;
}

export class FeedService {
  /**
   * Extract content from various sources
   */
  private static async extractContent(feedItem: FeedItem): Promise<ExtractedContent> {
    switch (feedItem.sourceType) {
      case 'url':
        if (feedItem.sourceUrl) {
          return await ContentExtractor.extractFromUrl(feedItem.sourceUrl);
        }
        break;
      
      case 'post':
        // For Carrot posts, we'd need to fetch the post data
        // For now, return the provided content
        return {
          content: feedItem.content,
          title: feedItem.sourceTitle,
          author: feedItem.sourceAuthor,
          url: feedItem.sourceUrl,
        };
      
      case 'file':
        // TODO: Implement file extraction
        return {
          content: feedItem.content,
          title: feedItem.sourceTitle,
          author: feedItem.sourceAuthor,
        };
      
      case 'manual':
      default:
        return {
          content: feedItem.content,
          title: feedItem.sourceTitle,
          author: feedItem.sourceAuthor,
        };
    }

    // Fallback to provided content
    return {
      content: feedItem.content,
      title: feedItem.sourceTitle,
      author: feedItem.sourceAuthor,
    };
  }

  /**
   * Preview what will be fed to an agent (without actually storing)
   */
  static async previewFeed(agentId: string, feedItem: FeedItem): Promise<FeedPreview> {
    // Extract and clean content
    const extractedContent = await this.extractContent(feedItem);
    
    // Chunk the content
    const chunks = EmbeddingService.chunkText(extractedContent.content);
    
    return {
      content: extractedContent.content,
      sourceType: feedItem.sourceType,
      sourceTitle: extractedContent.title || feedItem.sourceTitle,
      sourceAuthor: extractedContent.author || feedItem.sourceAuthor,
      chunks,
      estimatedMemories: chunks.length,
    };
  }

  /**
   * Feed content to an agent
   */
  static async feedAgent(
    agentId: string,
    feedItem: FeedItem,
    fedBy?: string
  ) {
    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    // Extract and clean content
    let extractedContent;
    try {
      extractedContent = await this.extractContent(feedItem);
    } catch (error) {
      console.error('[FeedService] Error extracting content:', error);
      // Provide fallback content if extraction fails
      extractedContent = {
        content: feedItem.content || 'Content extraction failed, using provided content',
        title: feedItem.sourceTitle || 'Unknown Title',
        author: feedItem.sourceAuthor,
        url: feedItem.sourceUrl
      };
    }
    
    // Simplified approach: Store content as single memory to avoid memory issues
    const memoryIds: string[] = [];
    
    try {
      // Limit content length to prevent memory issues
      const maxContentLength = 5000; // 5KB limit
      const contentToStore = extractedContent.content.length > maxContentLength 
        ? extractedContent.content.substring(0, maxContentLength) + '...'
        : extractedContent.content;

      const memoryData: MemoryData = {
        agentId,
        content: contentToStore,
        sourceType: feedItem.sourceType,
        sourceUrl: extractedContent.url || feedItem.sourceUrl,
        sourceTitle: extractedContent.title || feedItem.sourceTitle,
        sourceAuthor: extractedContent.author || feedItem.sourceAuthor,
        tags: feedItem.tags,
        threadId: feedItem.threadId,
        topicId: feedItem.topicId,
        fedBy,
      };

      const memory = await EmbeddingService.storeMemory(memoryData);
      memoryIds.push(memory.id);
      console.log(`[FeedService] Successfully stored memory for agent ${agentId}`);
    } catch (memoryError) {
      console.error('[FeedService] Error storing memory:', memoryError);
      // Return empty array but don't fail the entire operation
    }

    // Log the feed event
    const feedEvent = await prisma.agentFeedEvent.create({
      data: {
        agentId,
        eventType: 'feed',
        content: `Fed ${chunks.length} memory chunks from ${feedItem.sourceType}`,
        sourceUrl: feedItem.sourceUrl,
        sourceTitle: feedItem.sourceTitle,
        memoryIds,
        fedBy,
        metadata: {
          sourceType: feedItem.sourceType,
          chunkCount: chunks.length,
          tags: feedItem.tags,
        },
      },
    });

    return {
      memoryIds,
      feedEvent,
      chunkCount: chunks.length,
    };
  }

  /**
   * Feed multiple items to an agent
   */
  static async feedMultiple(
    agentId: string,
    feedItems: FeedItem[],
    fedBy?: string
  ) {
    const results = [];
    
    for (const feedItem of feedItems) {
      const result = await this.feedAgent(agentId, feedItem, fedBy);
      results.push(result);
    }

    return results;
  }

  /**
   * Get feed history for an agent
   */
  static async getFeedHistory(agentId: string, limit: number = 20) {
    return await prisma.agentFeedEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get agent's recent memories
   */
  static async getRecentMemories(agentId: string, limit: number = 20) {
    return await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Search agent's memories
   */
  static async searchMemories(
    agentId: string,
    query: string,
    limit: number = 10
  ) {
    return await EmbeddingService.findSimilarMemories(agentId, query, limit);
  }

  /**
   * Forget specific memories (soft delete by reducing confidence)
   */
  static async forgetMemories(agentId: string, memoryIds: string[], fedBy?: string) {
    const memories = await prisma.agentMemory.updateMany({
      where: {
        id: { in: memoryIds },
        agentId,
      },
      data: {
        confidence: 0.1, // Mark as forgotten but keep for audit
      },
    });

    // Log the forget event
    await prisma.agentFeedEvent.create({
      data: {
        agentId,
        eventType: 'forget',
        content: `Forgot ${memoryIds.length} memories`,
        memoryIds,
        fedBy,
        metadata: {
          memoryCount: memoryIds.length,
        },
      },
    });

    return memories;
  }

  /**
   * Reweight memories (adjust confidence scores)
   */
  static async reweightMemories(
    agentId: string,
    memoryUpdates: { id: string; confidence: number }[],
    fedBy?: string
  ) {
    const results = [];
    
    for (const update of memoryUpdates) {
      const memory = await prisma.agentMemory.update({
        where: {
          id: update.id,
          agentId,
        },
        data: {
          confidence: Math.max(0, Math.min(1, update.confidence)),
        },
      });
      results.push(memory);
    }

    // Log the reweight event
    await prisma.agentFeedEvent.create({
      data: {
        agentId,
        eventType: 'reweight',
        content: `Reweighted ${memoryUpdates.length} memories`,
        memoryIds: memoryUpdates.map(u => u.id),
        fedBy,
        metadata: {
          memoryCount: memoryUpdates.length,
          updates: memoryUpdates,
        },
      },
    });

    return results;
  }

  /**
   * Get agent memory statistics
   */
  static async getMemoryStats(agentId: string) {
    const [totalMemories, recentMemories, highConfidenceMemories] = await Promise.all([
      prisma.agentMemory.count({ where: { agentId } }),
      prisma.agentMemory.count({
        where: {
          agentId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
      prisma.agentMemory.count({
        where: {
          agentId,
          confidence: { gte: 0.8 },
        },
      }),
    ]);

    return {
      totalMemories,
      recentMemories,
      highConfidenceMemories,
    };
  }
}

export default FeedService;
