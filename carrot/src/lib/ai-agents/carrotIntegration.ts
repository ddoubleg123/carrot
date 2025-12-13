import { PrismaClient } from '@prisma/client';
import AgentRegistry from './agentRegistry';
import { FeedService, FeedItem } from './feedService';
import AgentSelector from './agentSelector';

const prisma = new PrismaClient();

export interface CarrotThread {
  id: string;
  patchId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CarrotPost {
  id: string;
  patchId: string;
  authorId: string;
  type: string;
  title?: string;
  body?: string;
  url?: string;
  tags: string[];
  createdAt: Date;
}

export interface CarrotPatch {
  id: string;
  handle: string;
  name: string;
  description?: string;
  tags: string[];
  theme?: string;
  createdAt: Date;
}

export interface AgentCarrotConnection {
  agentId: string;
  patchId: string;
  threadId?: string;
  postId?: string;
  connectionType: 'patch' | 'thread' | 'post';
  relevanceScore: number;
  lastInteraction: Date;
}

export class CarrotIntegration {
  /**
   * Connect agents to a Carrot patch based on content relevance
   */
  static async connectAgentsToPatch(
    patchId: string,
    query?: string,
    maxAgents: number = 3
  ): Promise<AgentCarrotConnection[]> {
    try {
      // Get patch information
      const patch = await prisma.patch.findUnique({
        where: { id: patchId },
        include: {
          posts: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!patch) {
        throw new Error(`Patch with ID ${patchId} not found`);
      }

      // Create search query from patch content
      const searchQuery = query || this.createPatchQuery(patch);

      // Find relevant agents
      const agentMatches = await AgentSelector.selectAgents({
        query: searchQuery,
        maxAgents,
        minScore: 0.3,
        context: `Carrot patch: ${patch.title}`,
      });

      // Create connections
      const connections: AgentCarrotConnection[] = [];
      
      for (const match of agentMatches) {
        const connection: AgentCarrotConnection = {
          agentId: match.agent.id,
          patchId: patch.id,
          connectionType: 'patch',
          relevanceScore: match.score,
          lastInteraction: new Date(),
        };

        connections.push(connection);

        // Update agent's associated patches
        if (!match.agent.associatedPatches.includes(patch.handle)) {
          await AgentRegistry.updateAgent(match.agent.id, {
            associatedPatches: [...match.agent.associatedPatches, patch.handle],
          });
        }
      }

      return connections;
    } catch (error) {
      console.error('Error connecting agents to patch:', error);
      return [];
    }
  }

  /**
   * Connect agents to a specific Carrot post
   */
  static async connectAgentsToPost(
    postId: string,
    query?: string,
    maxAgents: number = 2
  ): Promise<AgentCarrotConnection[]> {
    try {
      // Get post information
      const post = await prisma.patchPost.findUnique({
        where: { id: postId },
        include: {
          patch: true,
          author: true,
        },
      });

      if (!post) {
        throw new Error(`Post with ID ${postId} not found`);
      }

      // Create search query from post content
      const searchQuery = query || this.createPostQuery(post);

      // Find relevant agents
      const agentMatches = await AgentSelector.selectAgents({
        query: searchQuery,
        maxAgents,
        minScore: 0.4,
        context: `Carrot post in ${post.patch.title}`,
      });

      // Create connections
      const connections: AgentCarrotConnection[] = [];
      
      for (const match of agentMatches) {
        const connection: AgentCarrotConnection = {
          agentId: match.agent.id,
          patchId: post.patchId,
          postId: post.id,
          connectionType: 'post',
          relevanceScore: match.score,
          lastInteraction: new Date(),
        };

        connections.push(connection);
      }

      return connections;
    } catch (error) {
      console.error('Error connecting agents to post:', error);
      return [];
    }
  }

  /**
   * Feed Carrot content to relevant agents
   */
  static async feedCarrotContentToAgents(
    patchId: string,
    content: string,
    sourceType: 'post' | 'thread' | 'patch' = 'post',
    sourceId?: string
  ): Promise<{ agentId: string; memoryIds: string[] }[]> {
    try {
      // Find relevant agents for the patch
      const connections = await this.connectAgentsToPatch(patchId, content);

      const results: { agentId: string; memoryIds: string[] }[] = [];

      // Feed content to each relevant agent
      for (const connection of connections) {
        try {
          const feedItem: FeedItem = {
            content,
            sourceType: 'post',
            sourceTitle: `Carrot ${sourceType}`,
            sourceUrl: sourceId ? `/patch/${patchId}/${sourceId}` : undefined,
            threadId: sourceId,
            topicId: patchId,
          };

          const feedResult = await FeedService.feedAgent(connection.agentId, feedItem);
          results.push({
            agentId: connection.agentId,
            memoryIds: feedResult.memoryIds,
          });
        } catch (error) {
          console.error(`Error feeding content to agent ${connection.agentId}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error feeding Carrot content to agents:', error);
      return [];
    }
  }

  /**
   * Get agents connected to a Carrot patch
   */
  static async getPatchAgents(patchId: string): Promise<any[]> {
    try {
      const patch = await prisma.patch.findUnique({
        where: { id: patchId },
      });

      if (!patch) {
        return [];
      }

      // Find agents associated with this patch
      const agents = await AgentRegistry.getAgentsByPatches([patch.handle]);
      return agents;
    } catch (error) {
      console.error('Error getting patch agents:', error);
      return [];
    }
  }

  /**
   * Get agents for a specific query within a Carrot context
   */
  static async getAgentsForCarrotQuery(
    patchId: string,
    query: string,
    maxAgents: number = 3
  ): Promise<any[]> {
    try {
      const patch = await prisma.patch.findUnique({
        where: { id: patchId },
      });

      if (!patch) {
        return [];
      }

      const agentMatches = await AgentSelector.selectAgents({
        query,
        maxAgents,
        minScore: 0.3,
        context: `Carrot patch: ${patch.title}`,
      });

      return agentMatches.map(match => match.agent);
    } catch (error) {
      console.error('Error getting agents for Carrot query:', error);
      return [];
    }
  }

  /**
   * Create a search query from patch information
   */
  private static createPatchQuery(patch: any): string {
    const parts: string[] = [];
    
    if (patch.title) parts.push(patch.title);
    if (patch.description) parts.push(patch.description);
    if (patch.tags && patch.tags.length > 0) parts.push(patch.tags.join(' '));
    
    // Add content from ALL posts (no limit)
    if (patch.posts && patch.posts.length > 0) {
      const postContent = patch.posts
        .map((post: any) => post.title || post.body || '')
        .filter(Boolean)
        .join(' ');
      
      if (postContent) parts.push(postContent);
    }

    return parts.join(' ');
  }

  /**
   * Create a search query from post information
   */
  private static createPostQuery(post: any): string {
    const parts: string[] = [];
    
    if (post.title) parts.push(post.title);
    if (post.body) parts.push(post.body);
    if (post.tags && post.tags.length > 0) parts.push(post.tags.join(' '));
    if (post.patch?.title) parts.push(post.patch.title);
    if (post.patch?.tags && post.patch.tags.length > 0) parts.push(post.patch.tags.join(' '));

    return parts.join(' ');
  }

  /**
   * Sync agent knowledge with Carrot content
   */
  static async syncAgentKnowledge(patchId: string): Promise<void> {
    try {
      const patch = await prisma.patch.findUnique({
        where: { id: patchId },
        include: {
          posts: {
            orderBy: { createdAt: 'desc' },
            // NO LIMIT - feed ALL posts
          },
          facts: true,
          events: true,
          sources: true,
        },
      });

      if (!patch) {
        return;
      }

      // Get agents associated with this patch
      const agents = await this.getPatchAgents(patchId);

      // Feed ALL content to agents (no limits)
      for (const agent of agents) {
        try {
          // Feed ALL posts (no limit)
          for (const post of patch.posts) {
            const content = `${post.title || ''} ${post.body || ''}`.trim();
            if (content) {
              await FeedService.feedAgent(agent.id, {
                content,
                sourceType: 'post',
                sourceTitle: post.title || 'Carrot Post',
                sourceUrl: `/patch/${patch.handle}/${post.id}`,
                threadId: post.id,
                topicId: patchId,
              });
            }
          }

          // Feed ALL facts (no limit)
          for (const fact of patch.facts) {
            const content = `${fact.label}: ${fact.value}`;
            await FeedService.feedAgent(agent.id, {
              content,
              sourceType: 'manual',
              sourceTitle: 'Carrot Fact',
              threadId: fact.id,
              topicId: patchId,
            });
          }

          // Feed ALL events (no limit)
          for (const event of patch.events) {
            const content = `${event.title}: ${event.summary}`;
            await FeedService.feedAgent(agent.id, {
              content,
              sourceType: 'manual',
              sourceTitle: 'Carrot Event',
              threadId: event.id,
              topicId: patchId,
            });
          }
        } catch (error) {
          console.error(`Error syncing knowledge for agent ${agent.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing agent knowledge:', error);
    }
  }
}

export default CarrotIntegration;
