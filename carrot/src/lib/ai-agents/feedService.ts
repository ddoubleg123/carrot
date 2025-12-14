import { PrismaClient } from '@prisma/client';
import ContentExtractor, { ExtractedContent } from './contentExtractor';

const prisma = new PrismaClient();

export interface FeedItem {
  content: string;
  sourceType: 'url' | 'file' | 'post' | 'manual' | 'discovery';
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
   * Preview what will be fed to an agent
   */
  static async previewFeed(agentId: string, feedItem: FeedItem): Promise<FeedPreview> {
    // Extract and clean content
    const extractedContent = await this.extractContent(feedItem);
    
    // Estimate memory count (simplified)
    const estimatedMemories = 1; // We now store as single memory
    
    return {
      content: extractedContent.content,
      sourceType: feedItem.sourceType,
      sourceTitle: extractedContent.title || feedItem.sourceTitle,
      sourceAuthor: extractedContent.author || feedItem.sourceAuthor,
      chunks: [extractedContent.content], // Single chunk
      estimatedMemories,
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
    console.log(`[FeedService] Processing feed for agent ${agentId}`);

    // Extract and clean content
    let extractedContent: ExtractedContent;
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
    
    const memoryIds: string[] = [];

    // Ensure the Agent exists to satisfy FK constraint for AgentMemory
    try {
      let existing = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!existing) {
        console.log(`[FeedService] Agent ${agentId} not found in database. Attempting to create from featured agents...`);
        
        // Try to find the agent in featured agents and create it
        try {
          const { FEATURED_AGENTS } = await import('@/lib/agents');
          const featuredAgent = FEATURED_AGENTS.find(agent => agent.id === agentId);
          
          if (featuredAgent) {
            console.log(`[FeedService] Creating agent ${agentId} from featured agents...`);
            existing = await prisma.agent.create({
              data: {
                id: featuredAgent.id,
                name: featuredAgent.name,
                persona: `I am ${featuredAgent.name}. ${featuredAgent.personality?.approach || 'I provide expert knowledge in my field.'}`,
                domainExpertise: featuredAgent.domains || [],
                associatedPatches: [],
                vectorDbRef: null,
                knowledgeProfile: {
                  expertise: featuredAgent.personality?.expertise || 'General knowledge',
                  strengths: featuredAgent.strengths || [],
                  limitations: featuredAgent.limits || []
                },
                feedSubscriptions: [],
                metadata: {
                  source: 'featured_agent',
                  avatar: featuredAgent.avatar,
                  personality: featuredAgent.personality
                }
              }
            });
            console.log(`[FeedService] Successfully created agent ${agentId}: ${existing.name}`);
          } else {
            // Try enhanced agents as fallback
            const { ENHANCED_AGENTS } = await import('@/lib/agentMatching');
            const enhancedAgent = ENHANCED_AGENTS.find(agent => agent.id === agentId);
            
            if (enhancedAgent) {
              console.log(`[FeedService] Creating agent ${agentId} from enhanced agents...`);
              existing = await prisma.agent.create({
                data: {
                  id: enhancedAgent.id,
                  name: enhancedAgent.name,
                  persona: `I am ${enhancedAgent.name}, specialized in ${enhancedAgent.role}. I provide expert knowledge in ${enhancedAgent.expertise.join(', ')}.`,
                  domainExpertise: enhancedAgent.expertise || [],
                  associatedPatches: [],
                  vectorDbRef: null,
                  knowledgeProfile: {
                    expertise: enhancedAgent.role || 'General knowledge',
                    strengths: enhancedAgent.expandedKeywords?.slice(0, 5) || [],
                    limitations: []
                  },
                  feedSubscriptions: [],
                  metadata: {
                    source: 'enhanced_agent',
                    avatar: enhancedAgent.avatar,
                    role: enhancedAgent.role
                  }
                }
              });
              console.log(`[FeedService] Successfully created agent ${agentId}: ${existing.name}`);
            } else {
              const msg = `[FeedService] Agent ${agentId} not found in featured or enhanced agents. Cannot create memory without agent record.`
              console.error(msg);
              throw new Error(msg);
            }
          }
        } catch (createError) {
          console.error('[FeedService] Error creating agent:', createError);
          throw new Error(`Failed to create agent ${agentId}: ${createError}`);
        }
      }
    } catch (e) {
      console.error('[FeedService] Agent existence check/creation failed:', e);
      throw e;
    }

    try {
      // Limit content length to prevent memory issues
      const maxContentLength = 5000; // 5KB limit
      const contentToStore = extractedContent.content.length > maxContentLength 
        ? extractedContent.content.substring(0, maxContentLength) + '...'
        : extractedContent.content;

      console.log(`[FeedService] Attempting to create memory for agent ${agentId}, content length: ${contentToStore.length}`);

      // Create real memory in database
      const memory = await prisma.agentMemory.create({
        data: {
          agentId,
          content: contentToStore,
          embedding: [], // Will be populated by embedding service later
          sourceType: feedItem.sourceType,
          sourceUrl: extractedContent.url || feedItem.sourceUrl,
          sourceTitle: extractedContent.title || feedItem.sourceTitle,
          sourceAuthor: extractedContent.author || feedItem.sourceAuthor,
          tags: feedItem.tags || [],
          confidence: 1.0,
          threadId: feedItem.threadId,
          topicId: feedItem.topicId,
          fedBy: fedBy || 'system'
        }
      });

      memoryIds.push(memory.id);
      console.log(`[FeedService] Successfully stored memory for agent ${agentId}: ${memory.id}`);
    } catch (memoryError: any) {
      // Enhance logging for Prisma known request errors
      if (memoryError?.code) {
        console.error('[FeedService] Error storing memory (Prisma):', {
          code: memoryError.code,
          meta: memoryError.meta,
          message: memoryError.message,
        });
      } else {
        console.error('[FeedService] Error storing memory:', memoryError);
      }
      throw memoryError; // Re-throw to indicate failure
    }

    // Create feed event record (best-effort)
    let feedEvent: any = null;
    try {
      feedEvent = await prisma.agentFeedEvent.create({
        data: {
          agentId,
          eventType: 'feed',
          content: `Fed content: ${extractedContent.title || 'Untitled'}`,
          sourceUrl: extractedContent.url || feedItem.sourceUrl,
          sourceTitle: extractedContent.title || feedItem.sourceTitle,
          memoryIds,
          fedBy: fedBy || 'system',
          metadata: {
            sourceType: feedItem.sourceType,
            contentLength: extractedContent.content.length,
            tags: feedItem.tags || []
          }
        }
      });
      console.log(`[FeedService] Feed event logged for agent ${agentId}: ${feedEvent.id}`);
    } catch (eventError) {
      console.error('[FeedService] Error logging feed event:', eventError);
      // Don't fail the entire operation if event logging fails
    }

    return {
      memoryIds,
      feedEvent,
      chunkCount: memoryIds.length,
    };
  }

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
          url: feedItem.sourceUrl
        };
      
      case 'manual':
      case 'file':
      default:
        return {
          content: feedItem.content,
          title: feedItem.sourceTitle,
          author: feedItem.sourceAuthor,
          url: feedItem.sourceUrl
        };
    }
    
    // Fallback
    return {
      content: feedItem.content || 'No content available',
      title: feedItem.sourceTitle,
      author: feedItem.sourceAuthor,
      url: feedItem.sourceUrl
    };
  }

  /**
   * Get agent's feed history
   */
  static async getFeedHistory(agentId: string, limit: number = 20) {
    try {
      const feedEvents = await prisma.agentFeedEvent.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          eventType: true,
          content: true,
          sourceUrl: true,
          sourceTitle: true,
          memoryIds: true,
          fedBy: true,
          createdAt: true,
          metadata: true
        }
      });
      return feedEvents;
    } catch (error) {
      console.error('[FeedService] Error getting feed history:', error);
      return [];
    }
  }

  /**
   * Get agent's recent memories
   */
  static async getRecentMemories(agentId: string, limit: number = 20) {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          sourceType: true,
          sourceUrl: true,
          sourceTitle: true,
          sourceAuthor: true,
          tags: true,
          confidence: true,
          createdAt: true
        }
      });
      return memories;
    } catch (error) {
      console.error('[FeedService] Error getting recent memories:', error);
      return [];
    }
  }

  /**
   * Search agent's memories
   */
  static async searchMemories(agentId: string, query: string, limit: number = 10) {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: {
          agentId,
          OR: [
            { content: { contains: query, mode: 'insensitive' } },
            { sourceTitle: { contains: query, mode: 'insensitive' } },
            { sourceAuthor: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          sourceType: true,
          sourceUrl: true,
          sourceTitle: true,
          sourceAuthor: true,
          tags: true,
          confidence: true,
          createdAt: true
        }
      });
      return memories;
    } catch (error) {
      console.error('[FeedService] Error searching memories:', error);
      return [];
    }
  }

  /**
   * Get agent's memory statistics
   */
  static async getMemoryStats(agentId: string) {
    try {
      const [totalMemories, recentMemories, highConfidenceMemories] = await Promise.all([
        prisma.agentMemory.count({ where: { agentId } }),
        prisma.agentMemory.count({
          where: {
            agentId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        }),
        prisma.agentMemory.count({
          where: {
            agentId,
            confidence: { gte: 0.8 }
          }
        })
      ]);

      return {
        totalMemories,
        recentMemories,
        highConfidenceMemories
      };
    } catch (error) {
      console.error('[FeedService] Error getting memory stats:', error);
      return {
        totalMemories: 0,
        recentMemories: 0,
        highConfidenceMemories: 0
      };
    }
  }

  /**
   * Forget specific memories
   */
  static async forgetMemories(agentId: string, memoryIds: string[], fedBy?: string) {
    try {
      const result = await prisma.agentMemory.deleteMany({
        where: {
          id: { in: memoryIds },
          agentId // Ensure we only delete memories for this agent
        }
      });

      // Log the forget event
      await prisma.agentFeedEvent.create({
        data: {
          agentId,
          eventType: 'forget',
          content: `Forgot ${result.count} memories`,
          memoryIds,
          fedBy: fedBy || 'system',
          metadata: { deletedCount: result.count }
        }
      });

      return { count: result.count };
    } catch (error) {
      console.error('[FeedService] Error forgetting memories:', error);
      return { count: 0 };
    }
  }
}